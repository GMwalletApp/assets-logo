import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateVersion } from "./utils/manifest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../top-coins-1000.json");
const API_BASE = "https://pro-api.coingecko.com/api/v3";
const PAGE_SIZE = 250;
const MARKET_SCAN_COUNT = 200000;
const PER_CHAIN_LIMIT = 1000;

const SUPPORTED_CHAINS = {
    ethereum: "ethereum",
    binance: "binance-smart-chain",
    polygon: "polygon-pos",
    solana: "solana",
    base: "base",
    arbitrum: "arbitrum-one",
    tron: "tron",
} as const;

interface CoinGeckoMarketCoin {
    id: string;
    market_cap_rank: number | null;
}

interface CoinGeckoPlatformCoin {
    id: string;
    platforms?: Record<string, string>;
}

interface CoinGeckoAssetPlatform {
    id: string;
    native_coin_id: string | null;
}

interface TopCoinsManifest {
    version: string;
    updatedAt: string;
    source: "coingecko";
    chains: Record<string, string[]>;
}

function readEnvFileValue(filePath: string, key: string): string | undefined {
    if (!existsSync(filePath)) {
        return undefined;
    }

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const envKey = trimmed.slice(0, separatorIndex).trim();
        if (envKey !== key) {
            continue;
        }

        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        return rawValue.replace(/^['"]|['"]$/g, "");
    }

    return undefined;
}

function getApiKey(): string {
    const apiKey =
        process.env.COINGECKO_API_KEY?.trim() ||
        readEnvFileValue(join(__dirname, "../.env"), "COINGECKO_API_KEY") ||
        readEnvFileValue(join(__dirname, "../.env.local"), "COINGECKO_API_KEY");

    if (!apiKey) {
        throw new Error("Missing COINGECKO_API_KEY in environment, .env, or .env.local");
    }

    return apiKey;
}

async function fetchJson<T>(path: string, apiKey: string, retries = 5): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(`${API_BASE}${path}`, {
                headers: {
                    accept: "application/json",
                    "x-cg-pro-api-key": apiKey,
                },
            });

            if (response.ok) {
                return (await response.json()) as T;
            }

            if (response.status === 429 || response.status >= 500) {
                const retryAfter = Number(response.headers.get("retry-after") ?? "0");
                const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1);
                await Bun.sleep(waitMs);
                continue;
            }

            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        } catch (error) {
            lastError = error;
            await Bun.sleep(1000 * (attempt + 1));
        }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${path}`);
}

async function fetchTopMarkets(apiKey: string): Promise<CoinGeckoMarketCoin[]> {
    const pages = Math.ceil(MARKET_SCAN_COUNT / PAGE_SIZE);
    const coins: CoinGeckoMarketCoin[] = [];

    for (let page = 1; page <= pages; page++) {
        console.log(`Fetching market page ${page}/${pages}...`);
        const params = new URLSearchParams({
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: String(PAGE_SIZE),
            page: String(page),
            sparkline: "false",
            locale: "en",
        });

        const pageCoins = await fetchJson<CoinGeckoMarketCoin[]>(
            `/coins/markets?${params.toString()}`,
            apiKey,
        );
        coins.push(...pageCoins);
    }

    return coins
        .filter((coin) => typeof coin.market_cap_rank === "number" && coin.market_cap_rank > 0)
        .sort(
            (a, b) =>
                (a.market_cap_rank ?? Number.MAX_SAFE_INTEGER) -
                (b.market_cap_rank ?? Number.MAX_SAFE_INTEGER),
        )
        .slice(0, MARKET_SCAN_COUNT);
}

async function fetchPlatformsById(apiKey: string): Promise<Map<string, Record<string, string>>> {
    console.log("Fetching coin platform map...");
    const coins = await fetchJson<CoinGeckoPlatformCoin[]>(
        "/coins/list?include_platform=true",
        apiKey,
    );

    return new Map(
        coins.map((coin) => {
            const platforms = Object.fromEntries(
                Object.entries(coin.platforms ?? {}).filter(
                    ([, address]) => typeof address === "string" && address.trim().length > 0,
                ),
            );
            return [coin.id, platforms];
        }),
    );
}

async function fetchNativeChains(apiKey: string): Promise<Map<string, string[]>> {
    console.log("Fetching asset platform metadata...");
    const platforms = await fetchJson<CoinGeckoAssetPlatform[]>("/asset_platforms", apiKey);
    const targetEntries = Object.entries(SUPPORTED_CHAINS);
    const byCoinId = new Map<string, Set<string>>();

    for (const platform of platforms) {
        if (!platform.native_coin_id) {
            continue;
        }

        for (const [chainName, platformId] of targetEntries) {
            if (platform.id !== platformId) {
                continue;
            }

            if (!byCoinId.has(platform.native_coin_id)) {
                byCoinId.set(platform.native_coin_id, new Set());
            }

            byCoinId.get(platform.native_coin_id)!.add(chainName);
        }
    }

    return new Map([...byCoinId.entries()].map(([coinId, chains]) => [coinId, [...chains]]));
}

function pushUnique(values: string[], value: string): void {
    if (!values.includes(value) && values.length < PER_CHAIN_LIMIT) {
        values.push(value);
    }
}

async function generateTopCoinsJson(): Promise<void> {
    console.log("=== Generating top-coins-1000.json ===\n");

    const apiKey = getApiKey();
    const [markets, platformsById, nativeChainsByCoinId] = await Promise.all([
        fetchTopMarkets(apiKey),
        fetchPlatformsById(apiKey),
        fetchNativeChains(apiKey),
    ]);

    const chains = new Map<string, string[]>(
        Object.keys(SUPPORTED_CHAINS).map((chain) => [chain, []]),
    );

    for (const coin of markets) {
        const platforms = platformsById.get(coin.id) ?? {};

        for (const [chainName, platformId] of Object.entries(SUPPORTED_CHAINS)) {
            const address = platforms[platformId];
            if (address) {
                pushUnique(chains.get(chainName)!, address);
            }
        }

        const nativeChains = nativeChainsByCoinId.get(coin.id) ?? [];
        for (const chainName of nativeChains) {
            pushUnique(chains.get(chainName)!, "native");
        }
    }

    const manifest: TopCoinsManifest = {
        version: generateVersion(),
        updatedAt: new Date().toISOString(),
        source: "coingecko",
        chains: Object.fromEntries(chains.entries()),
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), "utf-8");

    console.log("\n=== Complete ===");
    console.log(`Saved to: ${OUTPUT_PATH}`);
    for (const [chain, values] of chains.entries()) {
        console.log(`${chain}: ${values.length}`);
    }
}

generateTopCoinsJson().catch((error) => {
    console.error(error);
    process.exit(1);
});

/** Types for the plain-JS shard layout shared by the mirror builder and the Worker. */
export declare const SHARD_COUNT: number;
export declare function shardIndex(gtin14: string): number;
export declare function shardKey(gtin14: string): string;
export declare const PRODUCT_FIELDS: string[];
export declare function tupleToProduct(tuple: unknown[]): Record<string, unknown>;

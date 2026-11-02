/* tslint:disable */
/* eslint-disable */

export class BonsaiWasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    advance_season(): string;
    apply_wire(segment_id: number, gauge_mm: number, dx: number, dy: number, dz: number): boolean;
    evaluate_rules(recent_loss: number): string;
    get_last_loss_ratio(): number;
    get_segments_buffer(): Float32Array;
    get_tree_info(): string;
    constructor(seed: number);
    prune_branch(segment_id: number): boolean;
    remove_wire(segment_id: number): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_bonsaiwasmengine_free: (a: number, b: number) => void;
    readonly bonsaiwasmengine_advance_season: (a: number) => [number, number];
    readonly bonsaiwasmengine_apply_wire: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly bonsaiwasmengine_evaluate_rules: (a: number, b: number) => [number, number];
    readonly bonsaiwasmengine_get_last_loss_ratio: (a: number) => number;
    readonly bonsaiwasmengine_get_segments_buffer: (a: number) => [number, number];
    readonly bonsaiwasmengine_get_tree_info: (a: number) => [number, number];
    readonly bonsaiwasmengine_new: (a: number) => number;
    readonly bonsaiwasmengine_prune_branch: (a: number, b: number) => number;
    readonly bonsaiwasmengine_remove_wire: (a: number, b: number) => number;
    readonly bonsai_create_engine: () => number;
    readonly bonsai_destroy_engine: (a: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

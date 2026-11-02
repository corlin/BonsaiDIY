/* tslint:disable */
/* eslint-disable */

export class BonsaiWasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 打包全部节间数据供前端 Three.js 直读：
     * 每个枝段布局 [id, order, radius, startX, startY, startZ, endX, endY, endZ] (共 9 个 f32)
     */
    get_segments_buffer(): Float32Array;
    constructor(seed: number);
    /**
     * 执行剪枝，切除指定枝条并激活潜伏芽
     */
    prune_branch(segment_id: number): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_bonsaiwasmengine_free: (a: number, b: number) => void;
    readonly bonsai_create_engine: () => number;
    readonly bonsai_destroy_engine: (a: number) => void;
    readonly bonsaiwasmengine_get_segments_buffer: (a: number) => [number, number];
    readonly bonsaiwasmengine_new: (a: number) => number;
    readonly bonsaiwasmengine_prune_branch: (a: number, b: number) => number;
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

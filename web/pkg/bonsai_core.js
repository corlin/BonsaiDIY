/* @ts-self-types="./bonsai_core.d.ts" */

/**
 * WASM 跨语言桥接引擎 (BonsaiWasmEngine)
 * 彻底基于纯净 ECS 架构 (BonsaiWorld + BonsaiScheduler)
 * 严格解耦物理仿真与图形渲染，支持多通道零拷贝缓冲区提取
 */
export class BonsaiWasmEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BonsaiWasmEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bonsaiwasmengine_free(ptr, 0);
    }
    /**
     * 推进生长季 (通过 BonsaiCommand 执行春抽梢/夏加粗/秋回流/冬休眠)
     * @returns {string}
     */
    advance_season() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.bonsaiwasmengine_advance_season(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 缠绕金属丝塑性定型
     * @param {number} segment_id
     * @param {number} gauge_mm
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @returns {boolean}
     */
    apply_wire(segment_id, gauge_mm, dx, dy, dz) {
        const ret = wasm.bonsaiwasmengine_apply_wire(this.__wbg_ptr, segment_id, gauge_mm, dx, dy, dz);
        return ret !== 0;
    }
    /**
     * 运行 Wiki 造型与比例美学规则审计系统
     * @param {number} recent_loss
     * @returns {string}
     */
    evaluate_rules(recent_loss) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.bonsaiwasmengine_evaluate_rules(this.__wbg_ptr, recent_loss);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 统一通用命令执行入口 (支持 JSON 格式指令输入与确定性回放)
     * @param {string} command_json
     * @returns {string}
     */
    execute_command(command_json) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(command_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.bonsaiwasmengine_execute_command(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 抽取潜伏芽位通道 (6-Float 步长)
     * [parent_id, pos_x, pos_y, pos_z, dir_x, state]
     * @returns {Float32Array}
     */
    get_buds_buffer() {
        const ret = wasm.bonsaiwasmengine_get_buds_buffer(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 抽取梢头叶托通道 (8-Float 步长，供 GPU InstancedMesh 批量实例化)
     * [parent_id, center_x, center_y, center_z, normal_x, normal_y, normal_z, leaf_count]
     * @returns {Float32Array}
     */
    get_foliage_buffer() {
        const ret = wasm.bonsaiwasmengine_get_foliage_buffer(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 获取最近一次修剪造成的生物质损失比例
     * @returns {number}
     */
    get_last_loss_ratio() {
        const ret = wasm.bonsaiwasmengine_get_last_loss_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
     * 抽取枝干几何通道 (9-Float 步长，直接映射 Float32Array 零拷贝切片)
     * [id, order, radius, start_x, start_y, start_z, end_x, end_y, end_z]
     * @returns {Float32Array}
     */
    get_segments_buffer() {
        const ret = wasm.bonsaiwasmengine_get_segments_buffer(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 获取整树概况元数据
     * @returns {string}
     */
    get_tree_info() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.bonsaiwasmengine_get_tree_info(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} seed
     */
    constructor(seed) {
        const ret = wasm.bonsaiwasmengine_new(seed);
        this.__wbg_ptr = ret;
        BonsaiWasmEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 修剪指定枝段 (通过 BonsaiCommand 执行原子剪枝与潜伏芽激活)
     * @param {number} segment_id
     * @returns {boolean}
     */
    prune_branch(segment_id) {
        const ret = wasm.bonsaiwasmengine_prune_branch(this.__wbg_ptr, segment_id);
        return ret !== 0;
    }
    /**
     * 拆除金属丝
     * @param {number} segment_id
     * @returns {boolean}
     */
    remove_wire(segment_id) {
        const ret = wasm.bonsaiwasmengine_remove_wire(this.__wbg_ptr, segment_id);
        return ret !== 0;
    }
}
if (Symbol.dispose) BonsaiWasmEngine.prototype[Symbol.dispose] = BonsaiWasmEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./bonsai_core_bg.js": import0,
    };
}

const BonsaiWasmEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_bonsaiwasmengine_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('bonsai_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

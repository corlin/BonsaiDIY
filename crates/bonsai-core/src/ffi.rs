use crate::model::TreeGraph;

#[no_mangle]
pub extern "C" fn bonsai_create_engine() -> *mut TreeGraph {
    let tree = Box::new(TreeGraph::new());
    Box::into_raw(tree)
}

#[no_mangle]
pub extern "C" fn bonsai_destroy_engine(ptr: *mut TreeGraph) {
    if !ptr.is_null() {
        unsafe { drop(Box::from_raw(ptr)) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_create_and_destroy() {
        let ptr = bonsai_create_engine();
        assert!(!ptr.is_null());
        bonsai_destroy_engine(ptr);
        // Destroying null pointer should safely no-op
        bonsai_destroy_engine(std::ptr::null_mut());
    }
}

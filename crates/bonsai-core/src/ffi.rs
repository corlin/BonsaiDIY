use crate::ecs::world::BonsaiWorld;

#[no_mangle]
pub extern "C" fn bonsai_create_engine() -> *mut BonsaiWorld {
    let world = Box::new(BonsaiWorld::new(2026));
    Box::into_raw(world)
}

#[no_mangle]
pub extern "C" fn bonsai_destroy_engine(ptr: *mut BonsaiWorld) {
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

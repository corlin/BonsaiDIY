use bonsai_core::rng::DeterministicRng;

#[test]
fn test_rng_determinism() {
    let mut rng1 = DeterministicRng::new(12345);
    let mut rng2 = DeterministicRng::new(12345);

    for _ in 0..100 {
        assert_eq!(rng1.next_f32(), rng2.next_f32());
    }
}

#[test]
fn test_rng_range() {
    let mut rng = DeterministicRng::new(42);
    for _ in 0..100 {
        let val = rng.range(5.0, 15.0);
        assert!(val >= 5.0 && val < 15.0);
    }
}

import sys, os, threading, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cart import *


def make():
    repo = InMemoryCartRepository()
    return CartService(repo, InMemoryCatalog({"a": 1000, "b": 250})), repo


class CartTests(unittest.TestCase):
    def test_add_and_total(self):
        s, _ = make()
        s.add_item("c1", "a", 2)
        c = s.add_item("c1", "b")
        self.assertEqual((c.item_count, c.total_cents), (3, 2250))

    def test_add_same_sku_accumulates(self):
        s, _ = make()
        s.add_item("c1", "a"); c = s.add_item("c1", "a", 2)
        self.assertEqual(c.items["a"].quantity, 3)

    def test_set_quantity_zero_removes(self):
        s, _ = make()
        s.add_item("c1", "a"); c = s.set_quantity("c1", "a", 0)
        self.assertEqual(len(c.items), 0)

    def test_validation(self):
        s, _ = make()
        with self.assertRaises(ProductNotFound): s.add_item("c1", "zzz")
        with self.assertRaises(CartError): s.add_item("c1", "a", 0)
        with self.assertRaises(CartError): s.add_item("c1", "a", 1000)

    def test_stale_write_rejected(self):
        s, repo = make()
        c = s.add_item("c1", "a")
        with self.assertRaises(ConcurrencyError):
            repo.save(c, expected_version=0)

    def test_concurrent_adds_lose_nothing(self):
        s, _ = make()
        ts = [threading.Thread(target=s.add_item, args=("c1", "a", 1)) for _ in range(6)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(s.get("c1").items["a"].quantity, 6)

    def test_ttl_expiry(self):
        now = [0]
        repo = InMemoryCartRepository(ttl_seconds=10, clock=lambda: now[0])
        s = CartService(repo, InMemoryCatalog({"a": 1}))
        s.add_item("c1", "a"); now[0] = 11
        self.assertEqual(s.get("c1").item_count, 0)

    def test_roundtrip(self):
        s, _ = make(); c = s.add_item("c1", "a", 2)
        self.assertEqual(Cart.from_dict(c.to_dict()), c)


if __name__ == "__main__":
    unittest.main()

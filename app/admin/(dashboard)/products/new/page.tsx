import { createProduct } from "@/lib/actions/products";

export default function NewProductPage() {
  return (
    <div style={{ padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>New Product</h1>
      <form action={createProduct} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13 }}>
          Name
          <input name="name" required placeholder="W852" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Description
          <textarea name="description" required style={{ display: "block", width: "100%", padding: 10, marginTop: 4, minHeight: 80 }} />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ fontSize: 13, flex: 1 }}>
            Category
            <input name="category" required placeholder="Sneaker" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13, flex: 1 }}>
            Gender
            <select name="gender" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}>
              <option>Men's</option>
              <option>Women's</option>
              <option>Unisex</option>
            </select>
          </label>
        </div>
        <label style={{ fontSize: 13 }}>
          Price (USD)
          <input name="price" type="number" step="0.01" required placeholder="350.00" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Colors (comma-separated)
          <input name="colors" required placeholder="Black/Navy, White/Pink" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Sizes — Korean mm (comma-separated)
          <input name="sizes" required placeholder="235, 240, 245, 250, 255" style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }} />
        </label>
        <p style={{ fontSize: 12, color: "var(--steel)" }}>
          One variant (SKU) is created per color × size combination, seeded at 0 stock in every
          location — add stock from the Inventory tab. Created as a Draft; activate it from the
          product page once photos/details are ready.
        </p>
        <button className="btn btn-brass" type="submit">
          Create Product
        </button>
      </form>
    </div>
  );
}

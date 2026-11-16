import { getBrands, getT } from "@/lib/context.ts";
import { LANGS } from "@/lib/i18n.ts";
import { createBrand, updateBrand } from "../actions.ts";

export default async function BrandsPage() {
  const { t } = await getT();
  const brands = await getBrands();
  return (
    <>
      <h1>{t.brands}</h1>
      <p className="muted">Each brand has its own campaigns, content, research, metrics, workflows and approvals. Agents receive the brand profile as context.</p>
      {brands.map((b) => (
        <details className="card" key={b.id}>
          <summary><b>{b.name}</b> <span className="muted small">/{b.slug} · {b.markets.join(", ")} · {b.languages.join("/")}</span></summary>
          <form action={updateBrand} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={b.id} />
            <div className="grid g2">
              <label>Website<input name="website" type="url" defaultValue={b.website ?? ""} /></label>
              <label>Industry<input name="industry" defaultValue={b.industry ?? ""} /></label>
              <label>Markets (comma-separated)<input name="markets" defaultValue={b.markets.join(", ")} /></label>
              <label>Voice<input name="voice" defaultValue={b.voice ?? ""} /></label>
            </div>
            <label>Description<textarea name="description" defaultValue={b.description ?? ""} /></label>
            <div className="inline small">Languages: {LANGS.map((l) => <label key={l} className="inline" style={{ margin: 0 }}><input type="checkbox" name="languages" value={l} defaultChecked={b.languages.includes(l)} style={{ width: "auto" }} />{l}</label>)}</div>
            <button className="primary" style={{ marginTop: 8 }}>{t.save}</button>
          </form>
        </details>
      ))}
      <div className="card">
        <h2>Add brand</h2>
        <form action={createBrand}>
          <div className="grid g3">
            <label>Name<input name="name" required /></label>
            <label>Slug<input name="slug" required pattern="[a-z0-9-]{2,40}" /></label>
            <label>Currency<input name="currency" defaultValue="USD" pattern="[A-Z]{3}" /></label>
            <label>Website<input name="website" type="url" /></label>
            <label>Industry<input name="industry" /></label>
            <label>Markets (comma-separated)<input name="markets" /></label>
          </div>
          <label>Description<textarea name="description" /></label>
          <label>Voice<input name="voice" /></label>
          <div className="inline small">Languages: {LANGS.map((l) => <label key={l} className="inline" style={{ margin: 0 }}><input type="checkbox" name="languages" value={l} defaultChecked={l === "en"} style={{ width: "auto" }} />{l}</label>)}</div>
          <button className="primary" style={{ marginTop: 8 }}>{t.create}</button>
        </form>
      </div>
    </>
  );
}

/**
 * Seeds ONLY real configuration: the Radiant brand profile (from the existing
 * company website content) and the default scheduled workflows (disabled).
 * No metrics, customers, campaigns results or activity are seeded.
 */
import pg from "pg";
import { DEFAULT_WORKFLOWS } from "../lib/agents.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  await c.query("begin");
  const { rows } = await c.query(
    `insert into brands (name, slug, website, industry, description, markets, languages, voice, currency)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (slug) do update set name = excluded.name
     returning id`,
    [
      "Radiant Advising Services", "radiant", null,
      "B2B industrial brokerage & trade consulting (paper & packaging supply chain)",
      "Strategic intermediary connecting suppliers, mills and buyers across waste paper (OCC/SOP/SWL), virgin pulp, tissue jumbo rolls, packaging and HORECA consumables between Tunisia, the GCC, Europe and Africa. Services: industrial brokerage, consulting & sourcing, documentation & risk control. Commission-based model. Based in Riyadh, Saudi Arabia.",
      JSON.stringify(["Saudi Arabia", "UAE", "India", "Tunisia", "EU (supply side)", "North Africa"]),
      JSON.stringify(["en", "ar", "fr"]),
      "Trustworthy, precise, industrial. Short sentences, specs-first, no hype.",
      "USD",
    ],
  );
  const brandId = rows[0].id;
  for (const w of DEFAULT_WORKFLOWS) {
    await c.query(
      `insert into workflows (brand_id, key, name, agent_slug, schedule, enabled, brief)
       select $1,$2,$3,$4,$5,false,$6 where not exists (select 1 from workflows where brand_id=$1 and key=$2)`,
      [brandId, w.key, w.name, w.agentSlug, w.schedule, w.brief],
    );
  }
  await c.query(`insert into audit_logs (actor, action, entity_type, entity_id, brand_id, details) values ('system','seed','brand',$1,$2,'{}')`, [String(brandId), brandId]);
  await c.query("commit");
  console.log(`Seeded brand #${brandId} and ${DEFAULT_WORKFLOWS.length} workflows (disabled).`);
} catch (e) {
  await c.query("rollback"); throw e;
} finally { c.release(); await pool.end(); }

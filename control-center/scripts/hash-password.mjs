import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error("Usage: npm run hash-password -- '<password of 12+ chars>'"); process.exit(1); }
const hash = bcrypt.hashSync(pw, 12);
console.log(`Hosting dashboard (Vercel etc.) value:\n${hash}\n`);
// Next.js expands "$" in .env files, so escape it there.
console.log(`.env / .env.local line:\nADMIN_PASSWORD_HASH=${hash.replace(/\$/g, "\\$")}`);

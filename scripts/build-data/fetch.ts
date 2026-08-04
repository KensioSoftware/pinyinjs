import { fetchSources } from "./sources.js";

await fetchSources(process.argv.includes("--force"));
process.stderr.write("sources cached\n");

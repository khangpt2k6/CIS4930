## Related Work

*Draft for review by the Related Work owner (Riyon, per the task split). Descriptions are limited to what our proposal states and to properties we use directly in our experiments; check each against the paper before submission. All five references were verified to exist with the stated authors, venue and year (Crossref, Nov 25).*

**Learned indexes.**
- **RMI [1].** Kraska et al. introduced learned indexes and the Recursive Model Index (RMI). An RMI is a hierarchy of models: a top model routes a key to one of many simple second-stage models, which predict the key's position. A bounded "last-mile" search then corrects the prediction. Our quick benchmark (Objective 5) uses this two-stage linear form.
- **PGM-index [3].** Ferragina and Vinciguerra approximate the key-to-position mapping with piecewise linear segments whose prediction error is bounded by a parameter ε. They give provable worst-case bounds and a fully-dynamic variant that supports inserts. We use the static index (ε = 64) and the dynamic variant.
- **RadixSpline [4].** Kipf et al. build a learned index in a single pass over sorted data: a spline approximates the mapping, and a radix table over key prefixes finds the right spline segment. Its size is set by the number of radix bits and the spline error.
- **ALEX [5].** Ding et al. made learned indexes updatable. ALEX adapts its tree of models to the data and stores keys in gapped arrays, which leave room for inserts.

**Benchmarking.** Marcus et al. [2] built SOSD (Search On Sorted Data), an open benchmark for learned and traditional indexes on sorted 64-bit keys. It ships real datasets, including the four we planned to use (books, fb, osm and wiki), and tunable configurations for each index. Our lookup experiments build on SOSD. Our ARM64 port adds Apple Silicon support but compiles out several indexes (see Experimental Setup).

**How this project differs.** We repeat one common benchmark on laptops with different architectures (Objective 5). We also measure, in one shared driver, workloads beyond static lookups: inserts, range scans and build time (Objective 4). [TODO (Riyon): state how this differs from the hardware platforms and workloads covered in [1] and [2], checked against the papers.]

[TODO (Riyon): add any further related work, e.g. on learned-index robustness or hardware effects, with verified citations.]

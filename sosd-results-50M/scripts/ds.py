import numpy as np

def downsample(src, dst, step=4, chunk=10_000_000):
    m = np.memmap(src, dtype=np.uint64, mode="r")[1:]
    sub = m[::step]
    with open(dst, "wb") as f:
        np.array([len(sub)], dtype=np.uint64).tofile(f)
        for i in range(0, len(sub), chunk):
            np.ascontiguousarray(sub[i:i+chunk]).tofile(f)
    print("wrote", dst, len(sub), "keys")

downsample("data/books_800M_uint64", "data/books_200M_uint64")
downsample("data/osm_cellids_800M_uint64", "data/osm_cellids_200M_uint64")

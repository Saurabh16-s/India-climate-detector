
"""
Build district-level flood and drought risk data for the India Climate Risk Tracker.

Sources
  Floods   : Dartmouth Flood Observatory (DFO) Global Active Archive (ArcGIS service)
             + optional India Flood Inventory (IFI) CSV that you export yourself
  Drought  : rainfall cached from Open-Meteo (already downloaded) + NASA POWER monthly API for the rest
  Boundaries: district GeoJSON (GADM-based, older district names)

Output: data/risk_data.json  (top 10 districts per state, 2005-2025 index series)

Usage
  pip install requests pandas numpy shapely
  python build_risk_data.py --states Assam Bihar Maharashtra Rajasthan
  python build_risk_data.py --states Assam --ifi ifi.csv

Everything downloaded is cached in ./data, so the script can be re-run and resumed
(Open-Meteo's free tier has daily limits; if you hit one, run again later).
Open-Meteo's free tier is for non-commercial use.
"""
import argparse, calendar, datetime as dt, json, math, os, sys, time
import numpy as np, pandas as pd, requests
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

DISTRICTS_URL = "https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson"
DFO_URL = ("https://services1.arcgis.com/AXaYBvnJsB5Q7sDF/ArcGIS/rest/services/"
           "Global_Archive_of_large_flood_events/FeatureServer/0/query")
NASA = "https://power.larc.nasa.gov/api/temporal/monthly/point"

Y0, Y1 = 2005, 2025          
BASE0, BASE1 = 2005, 2020      
W_DRY, W_ARID = 0.6, 0.4       
DATA = "data"


RIVER = {
    "Dhemaji": "Jiadhal, Brahmaputra", "Lakhimpur": "Subansiri, Ranganadi", "Barpeta": "Beki, Manas, Pagladiya",
    "Morigaon": "Brahmaputra, Kopili", "Dhubri": "Brahmaputra", "Nalbari": "Pagladiya, Brahmaputra",
    "Goalpara": "Brahmaputra, Dudhnoi", "Dibrugarh": "Brahmaputra, Burhidihing", "Nagaon": "Kopili, Kolong",
    "Darbhanga": "Kamla Balan, Bagmati", "Madhubani": "Kamla, Kosi", "Sitamarhi": "Bagmati, Lakhandei",
    "Supaul": "Kosi", "Saharsa": "Kosi", "Araria": "Parman, Bakra", "Khagaria": "Kosi, Ganga, Burhi Gandak",
    "Muzaffarpur": "Burhi Gandak, Bagmati", "Katihar": "Ganga, Kosi, Mahananda", "Kishanganj": "Mahananda, Mechi",
    "Sangli": "Krishna, Warna", "Kolhapur": "Panchganga, Krishna",
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)



ALL_STATES = ["Assam", "Bihar", "Maharashtra", "Rajasthan"] 


def load_districts(states):
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, "districts.geojson")
    if not os.path.exists(path):
        log("Downloading district boundaries (about 35 MB)...")
        r = requests.get(DISTRICTS_URL, timeout=300)
        r.raise_for_status()
        open(path, "wb").write(r.content)
    gj = json.load(open(path))
    out = []
    for f in gj["features"]:
        p = f["properties"]
        if p.get("NAME_1") not in states:
            continue
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        g = g.simplify(0.01, preserve_topology=True)
        c = g.representative_point()
        out.append({"state": p["NAME_1"], "name": p["NAME_2"], "geom": g, "lat": c.y, "lon": c.x})
    if not out:
        sys.exit("No districts matched --states. Check the spelling (Assam, Bihar, Maharashtra, Rajasthan).")
    return out



def pick(props, *names, default=None):
    low = {k.lower(): v for k, v in props.items()}
    for n in names:
        if n.lower() in low and low[n.lower()] is not None:
            return low[n.lower()]
    return default


def to_year_month(v):
    if v is None:
        return None
    try:
        if isinstance(v, (int, float)):
            d = dt.datetime.fromtimestamp(v / 1000.0 if v > 1e11 else v, dt.timezone.utc)
        else:
            d = pd.to_datetime(v)
        return d.year, d.month
    except Exception:
        return None


def fetch_dfo(where):
    path = os.path.join(DATA, "dfo_india.json")
    if os.path.exists(path):
        return json.load(open(path))
    feats, offset = [], 0
    while True:
        r = requests.get(DFO_URL, params={
            "where": where, "outFields": "*", "returnGeometry": "true", "f": "geojson",
            "resultOffset": offset, "resultRecordCount": 2000}, timeout=120)
        r.raise_for_status()
        js = r.json()
        if "error" in js:
            sys.exit(f"DFO service error: {js['error']}  (try --dfo-where with the right field name)")
        batch = js.get("features", [])
        feats += batch
        log(f"DFO: {len(feats)} events")
        if len(batch) < 2000 and not js.get("exceededTransferLimit"):
            break
        offset += len(batch)
    if feats:
        log("DFO fields found:", sorted(feats[0]["properties"].keys()))
    json.dump(feats, open(path, "w"))
    return feats


def flood_table(districts, dfo_feats, ifi_path):
    """returns {(district_index, year): [events, deaths, displaced]} and set of (idx, year, month) from DFO"""
    tree = STRtree([d["geom"] for d in districts])
    tab, seen = {}, set()

    def add(idx, y, dead, disp, share):
        row = tab.setdefault((idx, y), [0.0, 0.0, 0.0])
        row[0] += 1
        row[1] += dead * share
        row[2] += disp * share

    for f in dfo_feats:
        p = f["properties"]
        ym = to_year_month(pick(p, "Began", "began", "Start", "Date"))
        if not ym or not (Y0 <= ym[0] <= Y1):
            continue
        dead = float(pick(p, "Dead", "Deaths", default=0) or 0)
        disp = float(pick(p, "Displaced", default=0) or 0)
        geom = None
        if f.get("geometry"):
            try:
                geom = shape(f["geometry"])
                if not geom.is_valid:
                    geom = geom.buffer(0)
            except Exception:
                geom = None
        if geom is None:
            lon, lat = pick(p, "long", "lon", "longitude"), pick(p, "lat", "latitude")
            if lon is None or lat is None:
                continue
            geom = Point(float(lon), float(lat))
        hits = list(tree.query(geom, predicate="intersects"))
        for i in hits:
            add(int(i), ym[0], dead, disp, 1.0 / len(hits))
            seen.add((int(i), ym[0], ym[1]))

    if ifi_path:  
        df = pd.read_csv(ifi_path)
        df.columns = [c.lower() for c in df.columns]
        for _, r in df.iterrows():
            y = int(r["year"])
            if not (Y0 <= y <= Y1):
                continue
            hits = list(tree.query(Point(float(r["lon"]), float(r["lat"])), predicate="intersects"))
            for i in hits:
                m = int(r["month"]) if "month" in df.columns and not pd.isna(r.get("month")) else None
                if (int(i), y, m) in seen or (m is None and any(k[:2] == (int(i), y) for k in seen)):
                    continue  
                add(int(i), y, float(r.get("deaths", 0) or 0), float(r.get("affected", 0) or 0), 1.0)
    return tab



def fetch_nasa(lat, lon):
    """Monthly mean precipitation (mm/day) from NASA POWER. Small request, no key needed."""
    params = {"parameters": "PRECTOTCORR", "community": "AG", "longitude": round(lon, 3),
              "latitude": round(lat, 3), "start": BASE0, "end": Y1, "format": "JSON"}
    for attempt in range(6):
        try:
            r = requests.get(NASA, params=params, timeout=120)
            if r.status_code == 429:
                log("  NASA POWER rate limit, waiting 60 s...")
                time.sleep(60)
                continue
            r.raise_for_status()
            return {"monthly": r.json()["properties"]["parameter"]["PRECTOTCORR"]}
        except Exception as e:
            log(f"  request failed ({e}); retrying in 10 s")
            time.sleep(10)
    return None


def totals_from_raw(raw):
    """returns ({year: monsoon mm}, {year: annual mm}) from either cache format"""
    if "time" in raw: 
        df = pd.DataFrame({"t": pd.to_datetime(raw["time"]), "pr": raw["pr"]}).dropna()
        df["y"], df["m"] = df.t.dt.year, df.t.dt.month
        return df[df.m.between(6, 9)].groupby("y").pr.sum().to_dict(), df.groupby("y").pr.sum().to_dict()
    mons, ann = {}, {}
    for k, v in raw["monthly"].items(): 
        y, m = int(k[:4]), int(k[4:])
        if m == 13 or v is None or v < 0:
            continue
        mm = v * calendar.monthrange(y, m)[1] 
        ann[y] = ann.get(y, 0) + mm
        if 6 <= m <= 9:
            mons[y] = mons.get(y, 0) + mm
    return mons, ann


def rain_stats(idx, d):
    os.makedirs(os.path.join(DATA, "rain"), exist_ok=True)
    path = os.path.join(DATA, "rain", f"{idx}.json")
    if os.path.exists(path):
        raw = json.load(open(path))
    else:
        raw = fetch_nasa(d["lat"], d["lon"])
        if raw is None:
            return None
        json.dump(raw, open(path, "w"))
        time.sleep(1.5)
    mons, ann = totals_from_raw(raw)
    base = [mons[y] for y in range(BASE0, BASE1 + 1) if y in mons]
    if len(base) < 15:
        return None
    mu, sd = float(np.mean(base)), max(float(np.std(base, ddof=1)), 1e-6)
    annb = [ann[y] for y in range(BASE0, BASE1 + 1) if y in ann]
    return {"z": {y: (v - mu) / sd for y, v in mons.items()}, "annual": float(np.mean(annb))}



def pct_rank(vals):
    s = pd.Series(vals)
    return (s.rank(pct=True) * 100).tolist()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--states", nargs="+", default=ALL_STATES, help="states to score and output (rainfall is only fetched for these)")
    ap.add_argument("--ifi", help="optional CSV exported from the India Flood Inventory (year, month, lat, lon, deaths, affected)")
    ap.add_argument("--dfo-where", default="Country LIKE '%India%'")
    ap.add_argument("--top", type=int, default=10)
    a = ap.parse_args()

    D = load_districts(ALL_STATES)  # always all four, so cache file numbers never change
    sel = [i for i, d in enumerate(D) if d["state"] in a.states]
    log(f"{len(D)} districts loaded, scoring {len(sel)} in {', '.join(a.states)}")
    ftab = flood_table(D, fetch_dfo(a.dfo_where), a.ifi)

    years = list(range(Y0, Y1 + 1))
    raw = np.zeros((len(D), len(years)))
    for (i, y), (e, dead, disp) in ftab.items():
        raw[i, y - Y0] = e + 0.5 * math.log1p(dead) + 0.3 * math.log1p(disp)
    nz = raw[np.ix_(sel, range(len(years)))]
    nz = nz[nz > 0]
    p95 = np.percentile(nz, 95) if nz.size else 1.0
    flood_idx = np.clip(raw / p95 * 100, 0, 100)

    drought_idx = np.zeros_like(flood_idx)
    missing = set()
    for n, i in enumerate(sel):
        d = D[i]
        rs = rain_stats(i, d)
        if rs is None:
            missing.add(i)
            continue
        arid = 1 - min(rs["annual"] / 1500.0, 1.0)
        for k, y in enumerate(years):
            z = rs["z"].get(y, 0.0)
            dry = min(100.0, max(0.0, -z) / 2.5 * 100)
            drought_idx[i, k] = min(100.0, W_DRY * dry + W_ARID * arid * 100)
        if (n + 1) % 10 == 0:
            log(f"  rainfall ready for {n + 1}/{len(sel)} districts")
    if missing:
        log(f"\nWARNING: no rainfall for {len(missing)} districts (they are treated as flood-only): "
            + ", ".join(D[i]["name"] for i in sorted(missing)[:15]) + (" ..." if len(missing) > 15 else ""))

    fs, ds = flood_idx.mean(axis=1), drought_idx.mean(axis=1)
    pf, pdr = np.zeros(len(D)), np.zeros(len(D))
    pf[sel] = pct_rank(fs[sel])
    pdr[sel] = pct_rank(ds[sel])

    out = {"generated": dt.date.today().isoformat(), "years": years,
           "method": ("Flood index = DFO/IFI events, deaths and displaced per district-year, scaled by the 95th percentile. "
                      "Drought index = 60% monsoon (Jun-Sep) rainfall shortfall z-score vs the 2005-2020 average + 40% chronic dryness. "
                      "Rainfall from Open-Meteo (ERA5) and NASA POWER. "
                      "Hazard = whichever has the higher percentile rank; top districts per state by that percentile."),
           "states": {}}
    for st in a.states:
        rows = []
        for i, d in enumerate(D):
            if d["state"] != st:
                continue
            hz = "Flood" if (i in missing or pf[i] >= pdr[i]) else "Drought"
            series = flood_idx[i] if hz == "Flood" else drought_idx[i]
            rows.append({"name": d["name"], "lat": round(d["lat"], 3), "lon": round(d["lon"], 3), "hazard": hz,
                         "score": round(float(max(pf[i], pdr[i])), 1), "flood_score": round(float(fs[i]), 1),
                         "drought_score": round(float(ds[i]), 1), "river": RIVER.get(d["name"], "") if hz == "Flood" else "",
                         "rain_missing": i in missing, "series": [int(round(v)) for v in series]})
        rows.sort(key=lambda r: -r["score"])
        for k, r in enumerate(rows[:a.top]):
            r["rank"] = k + 1
        out["states"][st] = rows[:a.top]
        log(f"\n{st}: top {a.top}")
        for r in out["states"][st]:
            log(f"  {r['rank']:>2}. {r['name']:<22} {r['hazard']:<8} score {r['score']:>5}  river: {r['river'] or '-'}")

    json.dump(out, open(os.path.join(DATA, "risk_data.json"), "w"), indent=1)
    log(f"\nWrote {DATA}/risk_data.json")


if __name__ == "__main__":
    main()

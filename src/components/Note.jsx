export default function Note() {
  return (
    <p className="note"><b>Data and method.</b> Flood index: Dartmouth Flood Observatory large-flood events matched to districts (2005 to 2021; the source records end there). Drought index: monsoon (Jun to Sep) rainfall shortfall against the 2005 to 2020 average, from Open-Meteo (ERA5) and NASA POWER, plus a chronic-dryness baseline. The top 10 per state are ranked by percentile among 126 districts in Assam, Bihar, Maharashtra and Rajasthan, so a ranking shows relative risk, not absolute risk. Flood events are large regional footprints, so neighbouring districts share much of the signal and small local floods are missed. District names follow an older boundary file (Majuli is inside Jorhat). River names are listed from general knowledge and the lines for some small tributaries are hand-traced approximations.</p>
  );
}

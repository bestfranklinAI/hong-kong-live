# Regional weather observations

Weather mode offers station selection from HKO's current weather report. The checked report contains 27 temperature stations. Coverage follows the source response rather than a hard-coded station count.

Source: [HKO weather API documentation](https://www.hko.gov.hk/en/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf). The adapter requests `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en`.

Each metric retains its source station and observation time. The checked report supplies humidity only for Hong Kong Observatory; other stations show an unavailable reading. The interface never copies Observatory humidity to other stations. Station observations do not represent every street in a district. There is no automatic nearest-station selection or station map layer yet.

The reference and regional API views share a successful raw-report cache for 60 seconds and coalesce concurrent requests. The regional view considers source observations fresh for 60 minutes and retains them for at most 90 minutes, accounting for the report's hourly cadence. Fetch results are retained for at most 15 minutes without a successful refresh. The browser also masks individual metrics with missing, expired or implausibly future timestamps. Fixture mode preserves recorded dates.

`/api/v1/weather/regional` provides the normalized station list. Changing stations does not fetch the upstream report again. Separate one-minute regional feeds, additional humidity coverage and wind observations are not integrated in this slice.

Verification covers normalization, missing station humidity, invalid timestamps, shared fetches, cache expiry and failed-fetch retry. The full project check passes 76 tests, type checking, linting and the production build.

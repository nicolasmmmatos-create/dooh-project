import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Globe, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

var GEO_110 = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
var GEO_50 = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
var BRAZIL_STATES_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.json";

// Mapping Brazilian state abbreviations / names to IBGE codes
var BRAZIL_STATE_IBGE: Record<string, string> = {
  AC: "12", Acre: "12",
  AL: "27", Alagoas: "27",
  AP: "16", "Amapá": "16", Amapa: "16",
  AM: "13", Amazonas: "13",
  BA: "29", Bahia: "29",
  CE: "23", "Ceará": "23", Ceara: "23",
  DF: "53", "Distrito Federal": "53",
  ES: "32", "Espírito Santo": "32", "Espirito Santo": "32",
  GO: "52", "Goiás": "52", Goias: "52",
  MA: "21", "Maranhão": "21", Maranhao: "21",
  MT: "51", "Mato Grosso": "51",
  MS: "50", "Mato Grosso do Sul": "50",
  MG: "31", "Minas Gerais": "31",
  PA: "15", "Pará": "15", Para: "15",
  PB: "25", "Paraíba": "25", Paraiba: "25",
  PR: "41", "Paraná": "41", Parana: "41",
  PE: "26", Pernambuco: "26",
  PI: "22", "Piauí": "22", Piaui: "22",
  RJ: "33", "Rio de Janeiro": "33",
  RN: "24", "Rio Grande do Norte": "24",
  RS: "43", "Rio Grande do Sul": "43",
  RO: "11", "Rondônia": "11", Rondonia: "11",
  RR: "14", Roraima: "14",
  SC: "42", "Santa Catarina": "42",
  SP: "35", "São Paulo": "35", "Sao Paulo": "35",
  SE: "28", Sergipe: "28",
  TO: "17", Tocantins: "17",
};

interface Device {
  id: string;
  name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean | null;
  last_seen: string | null;
  playlist_id: string | null;
  location_label: string | null;
}

type StatusFilter = "all" | "online" | "offline";

function isOnline(d: Device) {
  if (!d.is_active) return false;
  if (!d.last_seen) return false;
  var diff = Date.now() - new Date(d.last_seen).getTime();
  return diff < 3 * 60 * 1000;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "desconhecido";
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return "há " + mins + " min";
  var hours = Math.floor(mins / 60);
  if (hours < 24) return "há " + hours + "h";
  var days = Math.floor(hours / 24);
  return "há " + days + " dia" + (days > 1 ? "s" : "");
}

function getBoundingBox(devs: Device[]): { center: [number, number]; zoom: number } {
  if (devs.length === 0) return { center: [-51, -14], zoom: 3 };
  if (devs.length === 1) return { center: [devs[0].longitude as number, devs[0].latitude as number], zoom: 10 };

  var lats = devs.map(function (d) { return d.latitude as number; });
  var lngs = devs.map(function (d) { return d.longitude as number; });
  var minLat = Math.min.apply(null, lats);
  var maxLat = Math.max.apply(null, lats);
  var minLng = Math.min.apply(null, lngs);
  var maxLng = Math.max.apply(null, lngs);

  var centerLat = (minLat + maxLat) / 2;
  var centerLng = (minLng + maxLng) / 2;
  var spread = Math.max(maxLat - minLat, maxLng - minLng);

  var zoom = 4;
  if (spread >= 20) zoom = 3;
  else if (spread >= 8) zoom = 5;
  else if (spread >= 3) zoom = 7;
  else if (spread >= 1) zoom = 10;
  else zoom = 14;

  return { center: [centerLng, centerLat], zoom: zoom };
}

function isCenterInBrazil(c: [number, number]): boolean {
  var lng = c[0];
  var lat = c[1];
  return lat >= -33 && lat <= 5 && lng >= -73 && lng <= -34;
}

const DeviceMap = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [tooltip, setTooltip] = useState<{
    device: Device;
    x: number;
    y: number;
  } | null>(null);
  const [center, setCenter] = useState<[number, number]>([-51, -14]);
  const [zoom, setZoom] = useState(3);
  const initialFocusDone = useRef(false);

  const fetchDevices = useCallback(async () => {
    var { data } = await supabase
      .from("devices")
      .select(
        "id, name, city, region, country, latitude, longitude, is_active, last_seen, playlist_id, location_label"
      )
      .not("latitude", "is", null);
    if (data) setDevices(data as Device[]);
  }, []);

  useEffect(() => {
    fetchDevices();
    var interval = setInterval(fetchDevices, 60000);
    return function () {
      clearInterval(interval);
    };
  }, [fetchDevices]);

  const filtered = useMemo(
    function () {
      return devices.filter(function (d) {
        if (statusFilter === "online" && !isOnline(d)) return false;
        if (statusFilter === "offline" && isOnline(d)) return false;
        if (countryFilter !== "all" && d.country !== countryFilter) return false;
        if (regionFilter !== "all" && d.region !== regionFilter) return false;
        return true;
      });
    },
    [devices, statusFilter, countryFilter, regionFilter]
  );

  // Reset region filter when country changes
  useEffect(function () {
    setRegionFilter("all");
  }, [countryFilter]);

  // Auto-focus on first load
  useEffect(function () {
    if (initialFocusDone.current) return;
    if (devices.length === 0) return;
    var withCoords = devices.filter(function (d) { return d.latitude !== null && d.longitude !== null; });
    if (withCoords.length === 0) return;
    var bb = getBoundingBox(withCoords);
    setCenter(bb.center);
    setZoom(bb.zoom);
    initialFocusDone.current = true;
  }, [devices]);

  var onlineCount = devices.filter(isOnline).length;
  var offlineCount = devices.length - onlineCount;

  var countries = useMemo(
    function () {
      var set = new Set<string>();
      devices.forEach(function (d) {
        if (d.country) set.add(d.country);
      });
      return Array.from(set).sort();
    },
    [devices]
  );

  // Regions derived from devices for the selected country
  var regions = useMemo(
    function () {
      if (countryFilter === "all") return [];
      var set = new Set<string>();
      devices.forEach(function (d) {
        if (d.country === countryFilter && d.region) set.add(d.region);
      });
      return Array.from(set).sort();
    },
    [devices, countryFilter]
  );

  function focusOnDevices() {
    var withCoords = filtered.filter(function (d) { return d.latitude !== null && d.longitude !== null; });
    if (withCoords.length === 0) return;
    var bb = getBoundingBox(withCoords);
    setCenter(bb.center);
    setZoom(bb.zoom);
  }

  // Choose base GeoJSON based on zoom and center
  var geoUrl = useMemo(function () {
    if (zoom >= 4) return GEO_50;
    return GEO_110;
  }, [zoom]);

  // Subdivision overlay URL
  var subdivisionUrl = useMemo(function () {
    if (countryFilter === "all") return null;

    // Brazil: states or municipalities
    if (countryFilter === "BR" || countryFilter === "Brasil" || countryFilter === "Brazil") {
      if (regionFilter !== "all") {
        // Try to get IBGE code for the selected region
        var ibgeCode = BRAZIL_STATE_IBGE[regionFilter];
        if (ibgeCode) {
          return "https://servicodados.ibge.gov.br/api/v3/malhas/estados/" + ibgeCode + "?formato=application/vnd.geo+json";
        }
      }
      return BRAZIL_STATES_URL;
    }

    // Other countries: no specific subdivision URL available
    return null;
  }, [countryFilter, regionFilter]);

  var hasDevicesInBR = devices.some(function (d) {
    return d.country === "BR";
  });

  return (
    <div className="rounded-xl border border-border bg-card shadow-card animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center gradient-primary text-primary-foreground">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Dispositivos Conectados
            </h2>
            <p className="text-xs text-muted-foreground">
              {onlineCount} online / {offlineCount} offline
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filters */}
          {(["all", "online", "offline"] as StatusFilter[]).map(function (s) {
            var labels = { all: "Todos", online: "Online", offline: "Offline" };
            return (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={function () {
                  setStatusFilter(s);
                }}
                className="text-xs h-7"
              >
                {labels[s]}
              </Button>
            );
          })}
          {/* Country filter */}
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="País" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os países</SelectItem>
              {countries.map(function (c) {
                return (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {/* Region/State filter — only when a country is selected */}
          {countryFilter !== "all" && regions.length > 0 && (
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="Estado / Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {regions.map(function (r) {
                  return (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex gap-2 px-6 pb-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={function () {
            setCenter([0, 20]);
            setZoom(1);
          }}
        >
          <Globe className="w-3.5 h-3.5" />
          Mundo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={function () {
            setCenter([-51, -14]);
            setZoom(4);
          }}
        >
          🇧🇷 Brasil
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={focusOnDevices}
          disabled={filtered.length === 0}
        >
          <Navigation className="w-3.5 h-3.5" />
          Focar
        </Button>
      </div>

      {/* Map */}
      <div className="relative h-[420px] overflow-hidden rounded-b-xl">
        <style>{`
          @keyframes device-ping {
            0%   { r: 2;  opacity: 0.8; }
            70%  { r: 5; opacity: 0.1; }
            100% { r: 5; opacity: 0;   }
          }
        `}</style>
        <ComposableMap
          projectionConfig={{ scale: 147 }}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup center={center} zoom={zoom}>
            {/* Base world map */}
            <Geographies geography={geoUrl}>
              {function ({ geographies }: { geographies: any[] }) {
                return geographies.map(function (geo: any) {
                  var isBR =
                    hasDevicesInBR &&
                    geo.properties &&
                    (geo.properties.name === "Brazil" ||
                      geo.properties.name === "Brasil" ||
                      geo.id === "076");
                  return (
                    <Geography
                      key={geo.rsmKey || geo.properties.name || Math.random()}
                      geography={geo}
                      fill={
                        isBR
                          ? "hsl(222, 30%, 20%)"
                          : "hsl(222, 30%, 14%)"
                      }
                      stroke="hsl(222, 30%, 22%)"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          fill: "hsl(222, 30%, 18%)",
                          outline: "none",
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                });
              }}
            </Geographies>

            {/* Subdivision overlay (states/municipalities) */}
            {subdivisionUrl && (
              <Geographies geography={subdivisionUrl}>
                {function ({ geographies }: { geographies: any[] }) {
                  return geographies.map(function (geo: any) {
                    return (
                      <Geography
                        key={geo.rsmKey || (geo.properties && geo.properties.name) || Math.random()}
                        geography={geo}
                        fill="transparent"
                        stroke="#334155"
                        strokeWidth={0.3}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            fill: "hsla(222, 30%, 25%, 0.3)",
                            outline: "none",
                          },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  });
                }}
              </Geographies>
            )}

            {filtered.map(function (device) {
              var online = isOnline(device);
              return (
                <Marker
                  key={device.id}
                  coordinates={[
                    device.longitude as number,
                    device.latitude as number,
                  ]}
                  onMouseEnter={function (e: React.MouseEvent) {
                    var rect = (
                      e.currentTarget as Element
                    ).closest("svg");
                    if (rect) {
                      var svgRect = rect.getBoundingClientRect();
                      setTooltip({
                        device: device,
                        x: e.clientX - svgRect.left,
                        y: e.clientY - svgRect.top,
                      });
                    }
                  }}
                  onMouseLeave={function () {
                    setTooltip(null);
                  }}
                >
                  {online && (
                    <circle
                      r={2}
                      fill="none"
                      stroke="hsl(142, 71%, 45%)"
                      strokeWidth={1}
                      opacity={0.4}
                      style={{ animation: "device-ping 2s ease-out infinite" }}
                    />
                  )}
                  <circle
                    r={online ? 2 : 1.5}
                    fill={
                      online
                        ? "hsl(142, 71%, 45%)"
                        : "hsl(215, 20%, 45%)"
                    }
                    style={{
                      cursor: "pointer",
                      transition: "transform 200ms ease",
                    }}
                    opacity={online ? 1 : 0.7}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 12, 320),
              top: Math.max(tooltip.y - 10, 0),
            }}
          >
            <div className="rounded-lg border border-border bg-popover p-3 shadow-lg text-sm min-w-[180px]">
              <p className="font-semibold text-foreground">
                {tooltip.device.name || "Sem nome"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {[tooltip.device.city, tooltip.device.region]
                  .filter(Boolean)
                  .join(", ") || "Local desconhecido"}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span
                  className={
                    "inline-block w-2 h-2 rounded-full " +
                    (isOnline(tooltip.device)
                      ? "bg-green-400"
                      : "bg-muted-foreground")
                  }
                />
                <span className="text-xs text-foreground">
                  {isOnline(tooltip.device) ? "Online" : "Offline"}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {relativeTime(tooltip.device.last_seen)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state — subtle overlay, map stays visible */}
        {filtered.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-4 py-2 shadow-lg">
              <MapPin className="w-4 h-4 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Nenhum dispositivo com localização encontrado
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceMap;

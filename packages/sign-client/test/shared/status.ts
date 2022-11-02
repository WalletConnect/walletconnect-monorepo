import http from "http";

// The following 4 are the actual values that pertain to your account and this specific metric.
const apiKey = process.env.STATUSPAGE_API_KEY;
const pageId = "0z72kp3p7j8h";
const latencyMetricId = "dzjbt55mfxks";
const apiBase = "https://api.statuspage.io/v1";

const url = apiBase + "/pages/" + pageId + "/metrics/";
const authHeader = { Authorization: "OAuth " + apiKey };
const options = { method: "POST", headers: authHeader };

export const publishToStatusPage = (latencyMs: number) => {
  const timestampEpichSeconds = new Date().getTime() / 1000;
  const data = { data: {} };
  data.data[latencyMetricId] = [timestampEpichSeconds, latencyMs];

  return new Promise((resolve, reject) => {
    const request = http.request(url, options, function (res) {
      if (res.statusMessage === "Unauthorized") {
        return reject(new Error("Unauthorized"));
      }
      res.on("end", function () {
        return resolve(true);
      });
      res.on("error", (error) => {
        return reject(error);
      });
    });
    request.end(JSON.stringify({ data: data }));
  });
};

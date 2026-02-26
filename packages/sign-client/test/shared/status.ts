import https from "https";

const apiKey = process.env.STATUSPAGE_API_KEY;
const pageId = "0z72kp3p7j8h";
const latencyMetricId = "dzjbt55mfxks";
const apiBase = "https://api.statuspage.io/v1";

const url = apiBase + "/pages/" + pageId + "/metrics/data";
const headers = { Authorization: "OAuth " + apiKey, "Content-Type": "application/json" };
const options = { method: "POST", headers: headers };

export const publishToStatusPage = (latencyMs: number) => {
  const timestampEpichSeconds = new Date().getTime() / 1000;
  const data = { data: {} };
  data.data[latencyMetricId] = [{ timestamp: timestampEpichSeconds, value: latencyMs / 1000 }];

  return new Promise((resolve, reject) => {
    const request = https.request(url, options, function (res) {
      if (res.statusMessage === "Unauthorized") {
        return reject(new Error("Statuspage Call Unauthorized"));
      }
      res.setEncoding("utf8");
      const responseParts: string[] = [];
      res.on("end", function () {
        const response = responseParts.join("");
        if (res.statusCode! >= 500) {
          console.log(
            `Call to Statuspage failed with status code ${res.statusCode} and response ${response}`,
          );
          return resolve(false);
        }
        if (res.statusCode! >= 300) {
          return reject(
            new Error(
              `Call to Statuspage failed with status code ${res.statusCode} and response ${response}`,
            ),
          );
        }
        return resolve(true);
      });
      res.on("data", function (data: string) {
        responseParts.push(data);
      });
      res.on("error", (error) => {
        return reject(error);
      });
    });
    request.end(JSON.stringify(data));
  });
};

import tap from "tap";
import { HttpService } from "../src/http";

tap.test("GET `/` route", t => {
  t.plan(4);

  const { app } = new HttpService({
    logger: "debug",
  });

  // At the end of your tests it is highly recommended to call `.close()`
  // to ensure that all connections to external services get closed.
  t.tearDown(() => app.close());

  app.inject(
    {
      method: "GET",
      url: "/hello",
    },
    (err, response) => {
      t.error(err);
      t.strictEqual(response.statusCode, 200);
      t.strictEqual(response.text, `Hello World, this is WalletConnect`);
    },
  );
});

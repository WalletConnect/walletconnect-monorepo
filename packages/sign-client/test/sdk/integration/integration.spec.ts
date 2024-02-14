import { PairingTypes, SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { expect, describe, it, afterAll, beforeAll } from "vitest";
import {
  testConnectMethod,
  deleteClients,
  Clients,
  initTwoPairedClients,
  throttle,
} from "../../shared";

// describe("Sign Client Integration", () => {
//   let clients: Clients;
//   let pairingA: PairingTypes.Struct;
//   let sessionA: SessionTypes.Struct;

//   beforeAll(async () => {
//     ({ clients, pairingA, sessionA } = await initTwoPairedClients());
//   });

//   afterAll(async () => {
//     await deleteClients(clients);
//   });

//   it("init", () => {
//     expect(clients.A).to.be.exist;
//     expect(clients.B).to.be.exist;
//   });
//   describe("connect", () => {
//     it("connect (with old pairing)", async () => {
//       const { A, B } = clients;
//       expect(A.pairing.keys).to.eql(B.pairing.keys);
//       await testConnectMethod(clients, {
//         pairingTopic: pairingA.topic,
//       });
//     });
//   });
//   describe("update", () => {
//     it("updates session namespaces state with provided namespaces", async () => {
//       const topic = sessionA.topic;
//       const namespacesBefore = clients.A.session.get(topic).namespaces;
//       const namespacesAfter = {
//         ...namespacesBefore,
//         eip9001: {
//           accounts: ["eip9001:1:0x000000000000000000000000000000000000dead"],
//           methods: ["eth_sendTransaction"],
//           events: ["accountsChanged"],
//         },
//       };
//       const { acknowledged } = await clients.A.update({
//         topic,
//         namespaces: namespacesAfter,
//       });
//       await acknowledged();
//       const result = clients.A.session.get(topic).namespaces;
//       expect(result).to.eql(namespacesAfter);
//     });
//   });
//   describe("disconnect", () => {
//     describe("pairing", () => {
//       it("deletes the pairing on disconnect", async () => {
//         const topic = pairingA.topic;
//         const reason = getSdkError("USER_DISCONNECTED");
//         await clients.A.disconnect({ topic, reason });
//         expect(() => clients.A.pairing.get(topic)).to.throw(
//           `Missing or invalid. Record was recently deleted - pairing: ${topic}`,
//         );
//         const promise = clients.A.ping({ topic });
//         await expect(promise).rejects.toThrowError(
//           `No matching key. session or pairing topic doesn't exist: ${topic}`,
//         );
//       });
//     });
//     describe("session", () => {
//       it("deletes the session on disconnect", async () => {
//         const topic = sessionA.topic;
//         const reason = getSdkError("USER_DISCONNECTED");
//         await clients.A.disconnect({ topic, reason });
//         const promise = clients.A.ping({ topic });
//         expect(() => clients.A.session.get(topic)).to.throw(
//           `Missing or invalid. Record was recently deleted - session: ${topic}`,
//         );
//         await expect(promise).rejects.toThrowError(
//           `Missing or invalid. Record was recently deleted - session: ${topic}`,
//         );
//       });
//     });
//   });
// });

describe("Sign Client Integration", () => {
  it("connect (with new pairing)", async () => {
    const { clients, sessionA, pairingA } = await initTwoPairedClients({}, {}, { logger: "error" });
    expect(pairingA).to.be.exist;
    expect(sessionA).to.be.exist;
    expect(pairingA.topic).to.eq(sessionA.pairingTopic);
    const sessionB = clients.B.session.get(sessionA.topic);
    expect(sessionB).to.be.exist;
    expect(sessionB.pairingTopic).to.eq(sessionA.pairingTopic);
    expect(clients.A.metadata.redirect).to.exist;
    expect(clients.A.metadata.redirect?.native).to.exist;
    expect(clients.A.metadata.redirect?.universal).to.exist;
    expect(clients.B.metadata.redirect).to.exist;
    expect(clients.B.metadata.redirect?.native).to.exist;
    expect(clients.B.metadata.redirect?.universal).to.exist;
    await deleteClients(clients);
  });
  it("connect (with old pairing)", async () => {
    const {
      clients,
      pairingA: { topic: pairingTopic },
    } = await initTwoPairedClients({}, {}, { logger: "error" });
    const { A, B } = clients;
    expect(A.pairing.keys).to.eql(B.pairing.keys);
    await throttle(200);
    await testConnectMethod(clients, {
      pairingTopic,
    });
    await deleteClients(clients);
  });
  it("deletes the session on disconnect", async () => {
    const {
      clients,
      sessionA: { topic, self },
    } = await initTwoPairedClients({}, {}, { logger: "error" });
    const { self: selfB } = clients.B.session.get(topic);
    expect(clients.A.core.crypto.keychain.has(topic)).to.be.true;
    expect(clients.A.core.crypto.keychain.has(self.publicKey)).to.be.true;
    expect(clients.B.core.crypto.keychain.has(topic)).to.be.true;
    expect(clients.B.core.crypto.keychain.has(selfB.publicKey)).to.be.true;
    const reason = getSdkError("USER_DISCONNECTED");
    await clients.A.disconnect({ topic, reason });
    const promise = clients.A.ping({ topic });
    expect(() => clients.A.session.get(topic)).to.throw(
      `Missing or invalid. Record was recently deleted - session: ${topic}`,
    );
    await expect(promise).rejects.toThrowError(
      `Missing or invalid. Record was recently deleted - session: ${topic}`,
    );
    await throttle(2_000);
    expect(clients.A.core.crypto.keychain.has(topic)).to.be.false;
    expect(clients.A.core.crypto.keychain.has(self.publicKey)).to.be.false;
    await deleteClients(clients);
  });
});

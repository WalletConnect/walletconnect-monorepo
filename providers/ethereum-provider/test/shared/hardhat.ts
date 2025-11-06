import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";
import waitOn from "wait-on";

let nodeProcess: ChildProcessWithoutNullStreams | null = null;

export async function startHardhatNode(port: number) {
  if (nodeProcess) return;

  nodeProcess = spawn("npx", ["hardhat", "node", "--port", String(port)], {
    cwd: path.resolve(__dirname, "../../"), // project root
    stdio: "pipe",
    shell: true,
  });

  // Wait until RPC is ready
  await waitOn({
    resources: [`tcp:127.0.0.1:${port}`],
    timeout: 10000,
  });

  return nodeProcess;
}

export async function stopHardhatNode() {
  if (nodeProcess) {
    nodeProcess.kill("SIGINT");
    nodeProcess = null;
  }
}

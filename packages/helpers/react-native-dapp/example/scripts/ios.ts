import 'dotenv/config';
import * as child_process from 'child_process';

import * as appRootPath from 'app-root-path';
import * as chokidar from 'chokidar';

const opts: child_process.ExecSyncOptions = { cwd: `${appRootPath}`, stdio: 'inherit' };

chokidar.watch('contracts').on('all', () => {
  child_process.execSync('npx hardhat compile', opts);
});

child_process.execSync('npx kill-port 8545', opts);
child_process.execSync('npx hardhat node & react-native run-ios &', opts);
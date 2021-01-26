import 'dotenv/config';
import * as child_process from 'child_process';

child_process.execSync('npx hardhat compile', { stdio: 'inherit' });
child_process.execSync('npx hardhat node', { stdio: 'inherit' });
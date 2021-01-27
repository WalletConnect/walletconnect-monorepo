import 'dotenv/config';
import * as child_process from 'child_process';

child_process.execSync('npx pod-install', { stdio: 'inherit' });
import * as childProcess from 'child_process';
import * as express from 'express';
import * as util from 'util';

const exec = util.promisify(childProcess.exec);
const DEPLOY_FOLDER = '/home/kalle/Projects/tuplabottijr';
const PORT = 2840;

class WebHook {
  lastPid: number;
  deployInProgress: boolean;

  constructor() {
    this.createHTTPServer();
    this.deploy();
  }

  async deploy(): Promise<void> {
    if (this.deployInProgress) {
      setTimeout(() => {
        this.deploy();
      }, 1000);

      return;
    }

    this.deployInProgress = true;
    console.log('[info] Build started');

    console.log('[info] Pulling from origin');
    await exec(`git pull origin master`);

    console.log('[info] Reinstalling node modules');
    await exec('npm install');

    console.log('[info] Starting node app');
    if (this.lastPid) {
      process.kill(this.lastPid);
      this.lastPid = -1;
    }
    const proc = childProcess.exec('npm start');
    
    proc.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      if (this.lastPid !== -1) {
        process.stdout.write(data);
      }
    });
    
    setTimeout(async () => {
      const { stdout } = await exec('ps | grep node');
      const newestProc = stdout.trim().split('\n').pop();
      
      if (newestProc) {
        this.lastPid = Number(newestProc.split(' ')[0]);
      }

      console.log('[info] Build finished. Node PID: ' + this.lastPid);
  
      this.deployInProgress = false;
    }, 1000);
  }

  async createHTTPServer(): Promise<void> {
    const app = express();

    app.post('/git/hook', (req, res) => {
      this.deploy();
    });

    app.listen(PORT, () => {
      console.log(`[hook] Server listening on port ${PORT}`);
    });
  }
}

try {
  process.chdir(DEPLOY_FOLDER);
} catch (e) {
  console.log('Deploy folder doesn\'t exist.');
  process.exit();
}

const hook = new WebHook();
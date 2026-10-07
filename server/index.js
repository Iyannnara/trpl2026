import { app } from './app.js';
import { config } from './config.js';

const host = config.production ? '127.0.0.1' : '0.0.0.0';

app.listen(config.port, host, () => {
  console.log(`Classroom API listening on port ${config.port}`);
});
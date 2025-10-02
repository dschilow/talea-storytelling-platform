const { exec } = require('child_process');
exec('cd backend && encore run --port=4002', (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
  console.error(stderr);
});
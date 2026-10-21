"""Run a B verification command without shell interpolation; retain every log."""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, sys
root=Path(__file__).resolve().parents[4]
name=sys.argv[1]
command=sys.argv[2:]
log=Path(__file__).parent/'evidence'/name
if log.exists(): raise SystemExit('Refusing to overwrite evidence: '+str(log))
p=subprocess.run(command,cwd=root/'outputs/xiaon',stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
log.write_text('COMMAND: '+repr(command)+'\nUTC: '+datetime.now(timezone.utc).isoformat()+'\n'+p.stdout+'\nexitCode='+str(p.returncode)+'\n')
print(p.stdout)
print('exitCode='+str(p.returncode))
sys.exit(p.returncode)

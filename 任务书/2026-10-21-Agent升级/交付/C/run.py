from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[4]
log=Path(__file__).parent/'evidence'/sys.argv[1]
cmd=sys.argv[2:]
p=subprocess.run(cmd,cwd=root/'outputs/xiaon',capture_output=True,text=True)
log.write_text('COMMAND: '+repr(cmd)+'\n'+p.stdout+p.stderr+'\nexitCode='+str(p.returncode)+'\n')
print(p.stdout+p.stderr);print('exitCode='+str(p.returncode));sys.exit(p.returncode)

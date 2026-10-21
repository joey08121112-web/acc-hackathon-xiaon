import subprocess,sys,pathlib,datetime
out=pathlib.Path(__file__).parent/'evidence'/f'{sys.argv[1]}.log'
r=subprocess.run(sys.argv[2:],cwd=pathlib.Path(__file__).resolve().parents[4]/'outputs/xiaon',capture_output=True,text=True)
out.write_text('COMMAND: '+' '.join(sys.argv[2:])+'\nUTC: '+datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n'+r.stdout+r.stderr+f'\nexitCode={r.returncode}\n')
print(r.stdout[-4000:]+r.stderr[-2000:]);print('exitCode=',r.returncode,'log=',out)
sys.exit(r.returncode)

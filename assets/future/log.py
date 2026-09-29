"""Append a submitted batch to jobs.tsv: python log.py <family> <id,id,...> <job,job,...> (a repeated id becomes id#2)."""
import sys, csv, os
fam, ids, jobs = sys.argv[1], sys.argv[2].split(','), sys.argv[3].split(',')
assert len(ids) == len(jobs), (len(ids), len(jobs))
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'jobs.tsv')
seen = {r['id'] for r in csv.DictReader(open(p, encoding='utf8'), delimiter='\t')}
with open(p, 'a', encoding='utf8', newline='') as f:
    for i, j in zip(ids, jobs):
        f_, _, gid = i.rpartition(':')
        fam_ = f_ or fam
        k = gid if gid not in seen else f'{gid}#2'
        seen.add(k)
        f.write(f'{k}\t{fam_}\t{j}\n')
print(len(ids), 'logged')

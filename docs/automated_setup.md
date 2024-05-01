# Automated configuration and loading

This a draft for commands to automate the configuration and loading of
assemblies to Apollo

```
P="--profile auto"

apollo config ${P} address http://localhost:3999
apollo config ${P} accessType root
apollo config ${P} rootCredentials.username admin
apollo config ${P} rootCredentials.password pass
apollo login ${P}

mkdir -p demoData # or some other dir of your choice
cd demoData

wget https://ftp.ebi.ac.uk/pub/databases/wormbase/parasite/releases/WBPS19/species/schistosoma_haematobium/TD2_PRJEB44434/schistosoma_haematobium.TD2_PRJEB44434.WBPS19.genomic.fa.gz
wget https://ftp.ebi.ac.uk/pub/databases/wormbase/parasite/releases/WBPS19/species/schistosoma_mansoni/PRJEA36577/schistosoma_mansoni.PRJEA36577.WBPS19.genomic.fa.gz
wget https://ftp.ebi.ac.uk/pub/databases/wormbase/parasite/releases/WBPS19/species/schistosoma_haematobium/TD2_PRJEB44434/schistosoma_haematobium.TD2_PRJEB44434.WBPS19.annotations.gff3.gz
wget https://ftp.ebi.ac.uk/pub/databases/wormbase/parasite/releases/WBPS19/species/schistosoma_mansoni/PRJEA36577/schistosoma_mansoni.PRJEA36577.WBPS19.annotations.gff3.gz

gunzip *.gz

apollo assembly add-fasta ${P} -i schistosoma_haematobium.TD2_PRJEB44434.WBPS19.genomic.fa -a schistosoma_haematobium -f
apollo assembly add-fasta ${P} -i schistosoma_mansoni.PRJEA36577.WBPS19.genomic.fa -a schistosoma_mansoni -f

apollo feature import ${P} -i schistosoma_haematobium.TD2_PRJEB44434.WBPS19.annotations.gff3 -a schistosoma_haematobium -d
apollo feature import ${P} -i schistosoma_mansoni.PRJEA36577.WBPS19.annotations.gff3 -a schistosoma_mansoni -d
```

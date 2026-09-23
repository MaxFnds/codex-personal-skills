# Minhas skills pessoais

Backup privado das skills pessoais de MaxFnds. Nao inclui credenciais, conversas,
configuracao de conta, plugins nem skills internas (`.system`) fornecidas pelo Codex.
As skills internas acompanham a instalacao e podem variar entre versoes.

## Instalar em outro computador

Requisitos: Git, Node.js 18 ou superior e Codex instalado. Entre na sua conta
do GitHub quando o Git solicitar acesso ao repositorio privado.

```powershell
git clone https://github.com/MaxFnds/codex-personal-skills.git
cd codex-personal-skills
node skills.mjs install
```

O instalador usa a pasta pessoal `.codex/skills` quando ela ja existe; caso
contrario, usa `.agents/skills`, o caminho documentado atualmente. Tambem aceita
um destino explicito: `node skills.mjs install "C:\caminho\skills"`.
Nao executa os scripts das skills. Verifica hashes, bloqueia links e recusa
sobrescrever arquivos locais diferentes. Instalar novamente arquivos iguais e seguro.
Se uma skill nao aparecer, reinicie o Codex.

## Adicionar novas skills ao backup

Instale a nova skill normalmente no Codex e, nesta pasta, execute:

```powershell
git pull --ff-only
node skills.mjs export
git diff --stat
git diff
git add skills manifest.json
git commit -m "chore: atualiza minhas skills"
git push
```

O exportador procura skills pessoais em `.codex/skills` (ou `CODEX_HOME/skills`)
e `.agents/skills`. Se a mesma pasta existir nas duas origens, exige uma origem
explicita: `node skills.mjs export "C:\caminho\skills"`.
Somente diretorios com `SKILL.md` e o schema compartilhado do Mantis entram no backup.
Exportar adiciona e atualiza arquivos; nao apaga automaticamente skills ou arquivos
antigos. Para remover algo definitivamente do backup, remova o arquivo desejado
e execute `export` somente depois de remove-lo tambem da origem.

Para baixar novas skills do backup em outro PC:

```powershell
git pull --ff-only
node skills.mjs install
```

Se houver conflito com uma versao local diferente, o instalador para antes de
copiar. Guarde a versao local fora da pasta de skills e tente novamente, ou
mescle as alteracoes manualmente. Nao ha sincronizacao automatica ao entrar na conta.

## Integridade, seguranca e autoria

`node skills.mjs verify` verifica os arquivos contra `manifest.json`.
O exportador bloqueia nomes de arquivos sensiveis e alguns formatos comuns de
tokens. Essa verificacao nao substitui revisar o diff antes do push.

Os scripts de terceiros sao apenas armazenados, nao executados na instalacao.
Delegate Skills depende dos CLIs e contas dos respectivos agentes; alguns modos
tem permissoes amplas. Mantis requer isolamento ao executar testes de vulnerabilidade.
Planning with Files possui auxiliares que precisam de Python ou shell compatível.

As skills de terceiros mantem sua autoria e suas licencas. Consulte `PROVENANCE.json`
e `licenses/` para as origens conhecidas. As skills de design ja existentes foram
preservadas; suas origens nao foram inferidas.

Documentacao oficial: https://learn.chatgpt.com/docs/build-skills

Em PCs compartilhados, encerre suas sessoes do GitHub e Codex ao terminar.

# Instalação - Minikube no Windows

**Grupo:** Caio Abreu, Cassiano Abreu, Enzo Aquino, Gabriel Naoki e Wyllian Mariano

Este guia usa PowerShell e Docker Desktop com o backend WSL2. Execute cada comando na ordem, um por vez.

## 1. Pré-requisitos

- Windows 10 (versão 2004 ou superior) ou Windows 11
- Docker Desktop instalado e em execução (com backend WSL2 ativo)
- Pelo menos 4 GB de RAM livres e 2 CPUs disponíveis

Confirme que o Docker está funcionando:

```powershell
docker version
```

## 2. Instalar as ferramentas

Abra o PowerShell como administrador e execute:

```powershell
winget install Kubernetes.minikube
winget install Kubernetes.kubectl
winget install Helm.Helm
```

Feche e abra o PowerShell novamente para o terminal reconhecer os comandos.

Verifique as versões:

```powershell
minikube version
kubectl version --client
helm version
```

## 3. Iniciar o cluster

```powershell
minikube start --driver=docker --memory=6144 --cpus=2
```

Verifique se o nó está pronto:

```powershell
kubectl get nodes
```

A saída deve mostrar o nó `minikube` com o status `Ready`.

## 4. Criar o namespace da observabilidade

```powershell
kubectl create namespace observabilidade
```

## 5. Implantar o banco de dados

Estando na pasta raiz do repositório:

```powershell
kubectl apply -f k8s/banco
```

Aguarde o pod do banco ficar `Running`:

```powershell
kubectl get pods
```

## 6. Construir a imagem da aplicação

A imagem é criada dentro do Minikube, sem precisar de registro externo:

```powershell
minikube image build -t tarefas-app:1.0 ./app
```

## 7. Implantar a aplicação (2 réplicas)

```powershell
kubectl apply -f k8s/app
```

Verifique se as duas réplicas estão rodando:

```powershell
kubectl get pods
```

A saída deve mostrar o pod do banco e dois pods `app-...` com status `Running` e `1/1` em READY.

Se algum pod não ficar pronto, veja os logs:

```powershell
kubectl logs deployment/app
```

## 8. Acessar a aplicação

```powershell
minikube service app-service --url
```

Abra a URL retornada no navegador. Cadastre algumas tarefas e recarregue a página várias vezes: o nome do pod exibido na parte de baixo deve alternar entre as duas réplicas.

**Importante:** deixe este terminal aberto enquanto estiver usando a aplicação. Com o driver Docker, o acesso pela URL depende deste comando continuar rodando.

## 9. Instalar a stack de observabilidade (Helm)

Adicione os repositórios:

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

Instale o Prometheus e o Grafana:

```powershell
helm install kube-prometheus prometheus-community/kube-prometheus-stack -n observabilidade -f k8s/observabilidade/values-kube-prometheus.yaml
```

Instale o Loki com o Promtail:

```powershell
helm install loki grafana/loki-stack -n observabilidade -f k8s/observabilidade/values-loki.yaml
```

Instale o Tempo:

```powershell
helm install tempo grafana/tempo -n observabilidade
```

Aguarde os pods ficarem prontos:

```powershell
kubectl get pods -n observabilidade
```

Confirme o nome e as portas do Service do Tempo, que devem ser compatíveis com o `OTEL_EXPORTER_OTLP_ENDPOINT` do ConfigMap (porta 4318):

```powershell
kubectl get svc tempo -n observabilidade
```

## 10. Acessar o Grafana

Em um terminal separado, deixe este comando rodando:

```powershell
kubectl port-forward svc/kube-prometheus-grafana 3001:80 -n observabilidade
```

Abra `http://localhost:3001` no navegador e entre com:

- Usuário: `admin`
- Senha: `admin123`

No Grafana, use o menu **Explore** para ver:

- **Prometheus:** métricas dos pods, como `kube_pod_info`.
- **Loki:** logs com a consulta `{namespace="default"}`.
- **Tempo:** traces do serviço `tarefas-app`.

## 11. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Pod `app` em `CrashLoopBackOff` | Banco ainda não pronto ou senha incorreta | `kubectl logs deployment/app` e confira o Secret |
| `ImagePullBackOff` na aplicação | Imagem não foi construída no Minikube | Rode de novo `minikube image build -t tarefas-app:1.0 ./app` |
| Minikube lento ou pods sem memória | Pouca RAM para a stack | Recrie com `minikube delete` e depois `minikube start --driver=docker --memory=6144 --cpus=2` |

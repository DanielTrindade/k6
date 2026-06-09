// Servidor da réplica local. Serve os GETs a partir do db.json (json-server)
// e "faka" as operações de escrita exatamente como o JSONPlaceholder real:
// POST -> 201, PUT/PATCH -> 200, DELETE -> 200, SEM persistir nada.
//
// Por que fakar a escrita? O JSONPlaceholder não persiste mutações. Se a
// réplica persistisse de verdade, um DELETE /posts/5 repetido (CT-10, IDs
// aleatórios) passaria a devolver 404 na segunda vez, quebrando o "taxa de
// erro 0%". Fakando, o comportamento fica idêntico ao serviço público.
const jsonServer = require('json-server');

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults({
  logger: false,
});

server.use(middlewares); // static, cors, body-parser

// Intercepta escritas ANTES do router para devolver respostas fakeadas.
server.post('/posts', (req, res) => {
  res.status(201).jsonp(Object.assign({ id: 101 }, req.body));
});
server.put('/posts/:id', (req, res) => {
  res.status(200).jsonp(Object.assign({}, req.body, { id: Number(req.params.id) }));
});
server.patch('/posts/:id', (req, res) => {
  res.status(200).jsonp(Object.assign({ id: Number(req.params.id) }, req.body));
});
server.delete('/posts/:id', (req, res) => {
  res.status(200).jsonp({});
});

// Demais rotas (todos os GETs) seguem para o json-server normalmente.
server.use(router);

const PORT = process.env.PORT || 3000;
const httpServer = server.listen(PORT, '0.0.0.0', 1024, () => {
  console.log(`Réplica JSONPlaceholder ouvindo em http://0.0.0.0:${PORT}`);
});

httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;

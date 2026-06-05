// Gera o db.json com os mesmos volumes do JSONPlaceholder real:
//   10 users | 100 posts | 500 comments | 5000 photos | 100 albums | 200 todos
// Assim os CTs de alta volumetria (CT-02 /photos) e aninhados (CT-05
// /posts/1/comments) têm dados realistas na réplica local.
const fs = require('fs');

const lorem = 'lorem ipsum dolor sit amet consectetur adipiscing elit';

const db = { users: [], posts: [], comments: [], photos: [], albums: [], todos: [] };

for (let i = 1; i <= 10; i++) {
  db.users.push({
    id: i,
    name: `User ${i}`,
    username: `user${i}`,
    email: `user${i}@example.com`,
    phone: '1-770-736-8031',
    website: `user${i}.example.com`,
    company: { name: `Company ${i}` },
    address: { city: `City ${i}`, zipcode: `0000${i}` },
  });
}

for (let i = 1; i <= 100; i++) {
  db.posts.push({
    id: i,
    userId: ((i - 1) % 10) + 1,
    title: `${lorem} ${i}`,
    body: `${lorem} ${lorem}`,
  });
}

// 5 comentários por post (500 no total) -> /posts/1/comments retorna 5 itens.
let commentId = 1;
for (let postId = 1; postId <= 100; postId++) {
  for (let c = 0; c < 5; c++) {
    db.comments.push({
      id: commentId++,
      postId: postId,
      name: `comment ${c} of post ${postId}`,
      email: `commenter${c}@example.com`,
      body: lorem,
    });
  }
}

for (let i = 1; i <= 100; i++) {
  db.albums.push({ id: i, userId: ((i - 1) % 10) + 1, title: `album ${i}` });
}

// 50 fotos por álbum (5000 no total) -> /photos é o payload grande do CT-02.
let photoId = 1;
for (let albumId = 1; albumId <= 100; albumId++) {
  for (let p = 0; p < 50; p++) {
    db.photos.push({
      id: photoId,
      albumId: albumId,
      title: `photo ${photoId}`,
      url: `https://via.placeholder.com/600/${photoId}`,
      thumbnailUrl: `https://via.placeholder.com/150/${photoId}`,
    });
    photoId++;
  }
}

for (let i = 1; i <= 200; i++) {
  db.todos.push({ id: i, userId: ((i - 1) % 10) + 1, title: `todo ${i}`, completed: i % 2 === 0 });
}

fs.writeFileSync('db.json', JSON.stringify(db));
console.log(
  `db.json gerado: ${db.users.length} users, ${db.posts.length} posts, ` +
    `${db.comments.length} comments, ${db.photos.length} photos.`
);

fetch('http://localhost:8080/api/plans')
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));

const https = require('https');

async function testDelete() {
  try {
    // 1. Login
    const loginRes = await fetch('https://backend-tesi-l6ca.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.it', password: 'password' })
    });
    
    if (!loginRes.ok) {
      console.log('Login failed:', await loginRes.text());
      return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login success, token:', token.substring(0, 20) + '...');

    // 2. Get users
    const usersRes = await fetch('https://backend-tesi-l6ca.onrender.com/api/admin/users', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!usersRes.ok) {
      console.log('Get users failed:', await usersRes.text());
      return;
    }
    
    const users = await usersRes.json();
    console.log('Users found:', users.length);
    
    // 3. Find a dummy user to delete, or create one
    let targetUser = users.find(u => u.email.includes('dummy') || u.email.includes('testdelete'));
    
    if (!targetUser) {
      console.log('Creating dummy user for deletion...');
      const createRes = await fetch('https://backend-tesi-l6ca.onrender.com/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token 
        },
        body: JSON.stringify({
          firstName: 'Dummy',
          lastName: 'User',
          email: 'dummy' + Date.now() + '@test.it',
          password: 'password123',
          role: 'CLIENT'
        })
      });
      
      if (!createRes.ok) {
        console.log('Create user failed:', await createRes.text());
        return;
      }
      targetUser = await createRes.json();
      console.log('Created dummy user with ID:', targetUser.id);
    }
    
    // 4. Delete the user
    console.log('Attempting to delete user ID:', targetUser.id);
    const deleteRes = await fetch('https://backend-tesi-l6ca.onrender.com/api/admin/users/' + targetUser.id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    console.log('Delete status:', deleteRes.status);
    console.log('Delete response:', await deleteRes.text());
    
  } catch (err) {
    console.error('Error:', err);
  }
}

testDelete();

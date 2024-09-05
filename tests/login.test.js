const request = require('supertest');
const app = require('../server/server');

describe('POST /login', () => {
    it('should log in the user with correct credentials', async () => {
        const response = await request(app)
            .post('/findUser')
            .send({
                username: process.env.ADMIN_USERNAME,
                password: process.env.ADMIN_PASSWORD
            });

        expect(response.statusCode).toBe(200); //Expect success
        expect(response.body).toBe('OK');
    });
    
    it('should fail with wrong credentials', async () =>{
        const response = await request(app)
            .post('/findUser')
            .send({
                username:'999999999999999999999',
                password: '999999999999999999999'
            });
        
        expect(response.statusCode).toBe(401); // Expect faliure
        expect(response.body).toBe('NOT OK')       
    });
});

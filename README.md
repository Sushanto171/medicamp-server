# **MediCamp Server-Side (Backend)**

MediCamp is the backend server for the MediCamp web application, built using the **MERN stack**. It handles authentication, payments, camp data management, user registration, participant feedback, and more.

---

## **Live Demo**

- **Client-Side**: [MediCamp Client](https://medicamp-91966.web.app/)
- **Client Repository**: [Client-Side Code](https://github.com/Programming-Hero-Web-Course4/b10a12-client-side-Sushanto171)
- **Server Repository**: [Server-Side Code](https://github.com/Programming-Hero-Web-Course4/b10a12-server-side-Sushanto171)

---

## **Tech Stack**

- **Node.js**: Server-side JavaScript runtime.
- **Express.js**: Web framework for handling HTTP requests.
- **MongoDB**: NoSQL database for storing application data.
- **JWT (JSON Web Token)**: Authentication for secure data access.
- **Stripe**: Payment gateway integration for handling payments.
- **CORS**: Middleware for handling Cross-Origin Resource Sharing.
- **dotenv**: For managing environment variables.

---

## **Setup and Installation**

### **1. Clone the Repository**

```bash
git clone https://github.com/Programming-Hero-Web-Course4/b10a12-server-side-Sushanto171.git
cd b10a12-server-side-Sushanto171
```

### **2. Install Dependencies**

Run the following command to install the required dependencies:

```bash
npm install
```

### **3. Set Up Environment Variables**

Create a `.env` file in the root directory and add the following keys:

- `MONGO_URI` (MongoDB connection string)
- `JWT_SECRET` (Secret for signing JWT tokens)
- `STRIPE_SECRET_KEY` (Stripe secret key)

Example `.env` file:

```
MONGO_URI=mongodb://localhost:27017/medicamp
JWT_SECRET=mysecretkey
STRIPE_SECRET_KEY=mystripekey
```

### **4. Start the Server**

Run the following command to start the server:

```bash
npm start
```

The server will start and listen on the specified port (default: `5000`).

---

## **API Endpoints**

### **Public Endpoints**

1. **/camps**

   - **GET**: Retrieve all camps.
   - **POST**: Add a new camp (Organizer only).

2. **/users**

   - **GET**: Get all users.
   - **POST**: Register a new user.

3. **/feedbacks**

   - **GET**: Get all feedbacks.
   - **POST**: Add feedback from participants.

4. **/participants**
   - **GET**: Retrieve all participants for a specific camp.
   - **POST**: Register a participant for a camp.

---

## **Database Collections**

The application uses the following collections in the `MediCamp` database:

- **users**: Stores user information (organizers and participants).
- **payments**: Stores payment details for camp registrations.
- **camps**: Stores information about the camps.
- **participants**: Stores participant information and their registration status for camps.
- **feedbacks**: Stores feedback provided by participants after completing a camp.

---

## **Dependencies**

```json
"dependencies": {
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.2",
  "mongodb": "^6.12.0",
  "stripe": "^17.5.0"
}
```

---

## **Authentication and Authorization**

- **JWT Authentication**:
  - Secure routes by generating and verifying JWT tokens for authorized access.
  - JWT tokens are stored in the `Authorization` header for every request.

---

## **Payment Integration**

Stripe is used for handling payments in the system. When a participant registers for a camp, they are redirected to Stripe's secure payment gateway. After successful payment, the payment record is created in the `payments` collection.

---

## **How to Use**

1. **Register a User**:

   - Send a POST request to `/users` to register a new user.
   - Use JWT for authentication after registration.

2. **Add a Camp**:

   - Organizers can POST to `/camps` to create new camps.

3. **Register for a Camp**:

   - Participants can POST to `/participants` to register for a camp.

4. **Leave Feedback**:
   - Participants can submit feedback via the `/feedbacks` endpoint.

---

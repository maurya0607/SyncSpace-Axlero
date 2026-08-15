#Databse
# Database Design (Day 2)

## Database
- MongoDB

## Planned Collections

### Users
- _id
- name
- email
- password
- createdAt

### Rooms
- _id
- roomId
- roomName
- ownerId
- participants
- createdAt

### Whiteboards
- _id
- roomId
- drawingData
- updatedAt

### CodeSessions
- _id
- roomId
- language
- code
- updatedAt

## Status
Database schema is currently in the planning phase. Implementation will begin after the backend APIs are ready.
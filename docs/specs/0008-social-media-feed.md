# 0008: Social Media Feed

## 1. Overview
As part of making the platform more engaging, we are introducing a generic social media feed (Feature 9). This will allow users to share content, interact with each other, and build a sense of community. The feed is not exclusively tied to rewards or specific events, but serves as a general engagement tool.

## 2. Requirements

### 2.1 Functional Requirements
- **Create Posts:** Users can create posts that contain text, an image, or both.
- **View Feed:** Users can scroll through a feed of posts created by other users in chronological order.
- **Comments:** Users can comment on posts.
- **Likes:** Users can "like" posts (there is no "dislike" feature).
- **Unlike:** Users can remove their "like" from a post.

### 2.2 Out of Scope
- Dislikes or reaction types other than "like".
- Editing posts or comments (for the initial MVP, though could be added later).
- Threaded/nested comments (keep it to a single level of comments for MVP).

## 3. Data Models

### 3.1 Post Collection
Stores the main social feed posts.

```typescript
interface IPost {
  _id: ObjectId;
  author: ObjectId; // Ref to User
  content?: string; // Text content
  image?: string;   // URL to the uploaded image
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 PostLike Collection
Stores likes to prevent users from liking a post multiple times. 

```typescript
interface IPostLike {
  _id: ObjectId;
  post: ObjectId; // Ref to Post
  user: ObjectId; // Ref to User
  createdAt: Date;
}
```

### 3.3 Comment Collection
Stores comments on a post.

```typescript
interface IComment {
  _id: ObjectId;
  post: ObjectId; // Ref to Post
  author: ObjectId; // Ref to User
  content: string; // The comment text
  createdAt: Date;
  updatedAt: Date;
}
```

## 4. API Endpoints

### 4.1 Posts
- **`POST /api/v1/posts`**: Create a new post.
  - Payload: `{ content?: string; image?: string }`
  - Auth: Required.
- **`GET /api/v1/posts`**: Get a paginated feed of posts.
  - Query Params: `page`, `limit`
  - Response: Array of posts with author details and a boolean `isLiked` indicating if the current user has liked the post.
- **`DELETE /api/v1/posts/:postId`**: Delete a post (only author or admin).

### 4.2 Interactions
- **`POST /api/v1/posts/:postId/like`**: Like a post.
- **`DELETE /api/v1/posts/:postId/like`**: Unlike a post.
- **`POST /api/v1/posts/:postId/comments`**: Add a comment to a post.
  - Payload: `{ content: string }`
- **`GET /api/v1/posts/:postId/comments`**: Get paginated comments for a post.
- **`DELETE /api/v1/posts/:postId/comments/:commentId`**: Delete a comment (only author or admin).

## 5. Security & Validation
- **Image Validation:** Max size limitations and valid extensions.
- **Text Validation:** Max length for posts (e.g., 1000 characters) and comments (e.g., 500 characters). At least one of `content` or `image` must be provided for a post.
- **Authorization:** Only authenticated users can view the feed, create posts, and interact. Users can only delete their own content.

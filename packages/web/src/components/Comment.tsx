import type { JSX } from 'preact'
import { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import {
  ArrowUturnLeftIcon,
  PhotoIcon,
  CameraIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import './Comment.css'

export interface CommentData {
  id: string
  author: string
  avatar?: string
  timestamp: string
  content: string
  isCurrentUser?: boolean
  replies?: CommentData[]
}

export interface CommentProps {
  comment: CommentData
  onReply?: (commentId: string, content: string) => void
  nested?: boolean
}

export function Comment({ comment, onReply, nested = false }: CommentProps): JSX.Element {
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyContent, setReplyContent] = useState('')

  const handleReply = (): void => {
    if (replyContent.trim() !== "" && onReply !== undefined) {
      onReply(comment.id, replyContent)
      setReplyContent('')
      setShowReplyInput(false)
    }
  }

  const bubbleClass = comment.isCurrentUser === true
    ? 'comment-bubble comment-bubble-user'
    : 'comment-bubble'

  const itemClass = nested ? 'comment-item comment-nested' : 'comment-item'

  return (
    <div className={itemClass}>
      <div className="comment-avatar">
        {comment.avatar ?? comment.author.charAt(0).toUpperCase()}
      </div>
      <div className="comment-content">
        <div className="comment-header">
          <span className="comment-author">{comment.author}</span>
          <span className="comment-timestamp">{comment.timestamp}</span>
        </div>
        <div className={bubbleClass}>{comment.content}</div>
        <div className="comment-actions">
          <button
            className="comment-reply-button"
            onClick={() => setShowReplyInput(!showReplyInput)}
          >
            <ArrowUturnLeftIcon />
            Reply
          </button>
        </div>

        {showReplyInput && (
          <CommentReplyInput
            onSend={handleReply}
            value={replyContent}
            onChange={setReplyContent}
            onCancel={() => setShowReplyInput(false)}
          />
        )}

        {comment.replies !== undefined && comment.replies.length > 0 && (
          <div className="comment-replies">
            {comment.replies.map((reply) => (
              <Comment key={reply.id} comment={reply} onReply={onReply} nested={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export interface CommentReplyInputProps {
  onSend: () => void
  onCancel?: () => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CommentReplyInput({
  onSend,
  onCancel,
  value,
  onChange,
  placeholder = 'Write a reply...',
}: CommentReplyInputProps): JSX.Element {
  return (
    <div className="comment-reply-input">
      <div className="comment-input-wrapper">
        <textarea
          className="comment-textarea"
          placeholder={placeholder}
          value={value}
          onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
        />
        <div className="comment-input-footer">
          <div className="comment-input-tools">
            <button className="comment-tool-button" title="Add image">
              <PhotoIcon />
            </button>
            <button className="comment-tool-button" title="Take screenshot">
              <CameraIcon />
            </button>
          </div>
          <div className="comment-input-actions">
            {onCancel !== undefined && (
              <button
                className="comment-reply-button"
                onClick={onCancel}
                style={{ padding: '6px 12px' }}
              >
                Cancel
              </button>
            )}
            <button className="comment-send-button" onClick={onSend}>
              <PaperAirplaneIcon />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export interface CommentThreadProps {
  comments: CommentData[]
  onReply?: (commentId: string, content: string) => void
  children?: ComponentChildren
}

export function CommentThread({ comments, onReply, children }: CommentThreadProps): JSX.Element {
  return (
    <div className="comment-thread">
      {comments.map((comment) => (
        <Comment key={comment.id} comment={comment} onReply={onReply} />
      ))}
      {children}
    </div>
  )
}

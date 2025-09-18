import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichEditor({ value, onChange, placeholder = "Start writing your email template...", className }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={`border rounded-lg ${className}`}>
      {/* Toolbar */}
      <div className="border-b p-2 flex flex-wrap gap-1">
        {/* Text Formatting */}
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-testid="editor-bold"
        >
          <i className="fas fa-bold"></i>
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-testid="editor-italic"
        >
          <i className="fas fa-italic"></i>
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive('underline') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          data-testid="editor-underline"
        >
          <i className="fas fa-underline"></i>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Headings */}
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          data-testid="editor-h1"
        >
          H1
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          data-testid="editor-h2"
        >
          H2
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Lists */}
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-testid="editor-bullet-list"
        >
          <i className="fas fa-list-ul"></i>
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-testid="editor-numbered-list"
        >
          <i className="fas fa-list-ol"></i>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Text Alignment */}
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          data-testid="editor-align-left"
        >
          <i className="fas fa-align-left"></i>
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          data-testid="editor-align-center"
        >
          <i className="fas fa-align-center"></i>
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          data-testid="editor-align-right"
        >
          <i className="fas fa-align-right"></i>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Template Variables */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().insertContent('{{firstName}}').run()}
          data-testid="editor-insert-firstname"
        >
          <i className="fas fa-user mr-1"></i>
          First Name
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().insertContent('{{lastName}}').run()}
          data-testid="editor-insert-lastname"
        >
          <i className="fas fa-user mr-1"></i>
          Last Name
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().insertContent('{{email}}').run()}
          data-testid="editor-insert-email"
        >
          <i className="fas fa-envelope mr-1"></i>
          Email
        </Button>
      </div>

      {/* Editor */}
      <div className="min-h-[200px]">
        <EditorContent 
          editor={editor} 
          placeholder={placeholder}
          data-testid="rich-editor-content"
        />
      </div>

      {/* Helper Text */}
      <div className="border-t p-2 text-sm text-muted-foreground">
        <i className="fas fa-info-circle mr-1"></i>
        Use template variables like <code>{"{{firstName}}"}</code>, <code>{"{{lastName}}"}</code>, and <code>{"{{email}}"}</code> to personalize your emails
      </div>
    </div>
  );
}
import io

class StreamingBuffer(io.BytesIO):
    def __init__(self):
        super().__init__()
        self._chunks = []

    def write(self, b):
        super().write(b)
        # store chunk then reset buffer
        self.seek(0)
        data = self.read()
        self._chunks.append(data)
        self.seek(0)
        self.truncate(0)
        return len(b)
    
    def read_chunks(self):
        for chunk in self._chunks:
            yield chunk
        self._chunks = []


class GeneratorReader:
    """
    Wrap a bytes generator into a file-like object
    that MinIO can stream-upload.
    """
    def __init__(self, gen):
        self.gen = gen
        self.buffer = b""

    def read(self, size=-1):
        # If size < 0 just consume everything
        if size < 0:
            chunks = [self.buffer]
            self.buffer = b""
            for chunk in self.gen:
                chunks.append(chunk)
            return b"".join(chunks)

        while len(self.buffer) < size:
            try:
                self.buffer += next(self.gen)
            except StopIteration:
                break

        # Return exactly `size` bytes
        result = self.buffer[:size]
        self.buffer = self.buffer[size:]
        return result
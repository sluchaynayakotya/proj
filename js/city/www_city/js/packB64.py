import base64
import mimetypes
import glob

input_path  = 'data/'
output_path = '_DATA_.js'

files = [f for f in glob.glob(f'{input_path}**/*.*', recursive=True)]
with open(output_path, 'w') as out:
    out.write('var _DATA_ = {\n')
    for file in files:
        mimetype = mimetypes.guess_type(file)[0]
        with open(file, 'rb') as f:
            data = base64.b64encode(f.read()).decode('utf-8')
        file = file.replace('\\', '/')
        out.write(f'  "{file}": "data:{mimetype};base64,{data}",\n')
    out.write('};\n')

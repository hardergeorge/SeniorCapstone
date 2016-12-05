
TARGET1=prog-rep
HTML=main_html

all: pdf

dvi: ${TARGET1}.tex 
	/usr/local/apps/tex_live/current/bin/x86_64-linux/latex --shell-escape $(TARGET1).tex
	#bibtex $(TARGET1)
	/usr/local/apps/tex_live/current/bin/x86_64-linux/latex --shell-escape $(TARGET1).tex

ps: dvi
	dvips -R -Poutline -t letter ${TARGET1}.dvi -o ${TARGET1}.ps

pdf: ps
	ps2pdf ${TARGET1}.ps
	rm -f ${TARGET1}.aux
	rm -f ${TARGET1}.log
	rm -f ${TARGET1}.dvi
	rm -f ${TARGET1}.out
	rm -f ${TARGET1}.ps


clean-dvi:
	rm -f ${TARGET1}.aux
	rm -f ${TARGET1}.log
	rm -f ${TARGET1}.dvi
	rm -f ${TARGET1}.out
	rm -f ${TARGET1}.toc
	rm -f ${TARGET1}.blg
	rm -f ${TARGET1}.bbl

clean-ps: clean-dvi
	rm -f ${TARGET1}.ps

clean-pdf: clean-ps
	rm -f ${TARGET1}.pdf

clean: clean-pdf

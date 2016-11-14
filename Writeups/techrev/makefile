
TARGET1=tech
HTML=main_html


dvi: ${TARGET1}.tex 
#	run latex twice to get references correct
	latex ${TARGET1}.tex
#	you can also have a bibtex line here
	bibtex $(TARGET1)
	latex $(TARGET1).tex

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

clean-ps: clean-dvi
	rm -f ${TARGET1}.ps

clean-pdf: clean-ps
	rm -f ${TARGET1}.pdf

clean: clean-pdf
